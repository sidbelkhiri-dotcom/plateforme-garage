# MECAFORCE — Audit de code

**Date :** 18 août 2026
**Périmètre :** `schema.sql` + 18 migrations, `app/`, `components/`, `lib/`, `middleware.ts` — 97 fichiers, ~10 100 lignes
**Production :** https://mecaforce-site.vercel.app
**Méthode :** trois passes indépendantes (sécurité/RLS, conformité OPC, justesse du code), puis une passe **adverse** chargée de réfuter chaque constat grave. Les constats ci-dessous ont survécu à cette réfutation ; ceux qui n'y ont pas survécu sont listés en fin de document.

---

## En un paragraphe

L'application est solide. La RLS est activée sur les 15 tables, aucune policy `using (true)`, aucun secret exposé, l'escalade de rôle est fermée par trigger, les factures émises sont gelées, la règle d'arrondi des taxes est appliquée à la lettre et le bug UTC historique (D18) est bien corrigé sur les colonnes `date`. Ce qui reste tient en deux familles : **des documents légaux qui affichent la mauvaise donnée**, et **quelques colonnes que la RLS ne protège pas parce que la RLS est au niveau ligne, pas colonne**. Les sept premiers points ci-dessous méritent d'être corrigés avant la prochaine facture émise.

---

## Les 7 à corriger d'abord

### 1. L'évaluation imprimée affiche le total courant, pas le montant figé 🔴

`app/bons-travail/[id]/evaluation/page.tsx:47` puis l'affichage « Prix total (avant taxes) »

```ts
const totalHt = totaux?.total_ht ?? 0;   // vue SQL, recalculée à chaque affichage
```

`bon.montant_evaluation` — la colonne juridiquement engageante, tout l'objet de la décision D13 — **n'est jamais lue sur cette page**. Vérifié : le mot n'apparaît pas une seule fois dans le fichier.

**Ce qui se passe :** évaluation acceptée à 480 $, imprimée, remise au client. Le mécanicien ajoute deux lignes. On réimprime pour le dossier : le document affiche 620 $, sous la clause « cette évaluation lie le garage au prix indiqué ». Le document produit par l'application détruit la preuve du plafond de 480 $ — l'inverse exact du but.

**Correctif :** afficher `bon.montant_evaluation` dès qu'il est renseigné, et ne retomber sur `totaux.total_ht` que pour une évaluation encore non acceptée (avec une mention « projet, non accepté »).

### 2. Le bandeau de dépassement s'éteint au moment précis où l'on facture 🔴

`app/bons-travail/[id]/page.tsx:182`

```ts
const depasseEvaluation =
  bon.montant_evaluation != null && totalHt > bon.montant_evaluation &&
  ["autorise", "en_cours", "attente_piece"].includes(bon.statut);
```

`creer_facture()` **exige** `statut = 'termine'`. Le bandeau est donc structurellement éteint sur l'écran depuis lequel le comptoir clique « Créer la facture ». Et vérifié : `creer_facture()` (version finale, `2026-08-17_facture_sans_taxe.sql`) ne mentionne jamais `montant_evaluation` — aucune comparaison, aucun refus, aucun avertissement.

**Ce qui se passe :** évaluation acceptée 480 $, travaux réels 620 $, bon marqué terminé. Le comptoir ouvre le bon : plus aucun bandeau. Il facture 620 $ + taxes, le montant est figé, la facture part par courriel. Le client n'est légalement redevable que de 480 $.

**Correctif :** ajouter `'termine'` à la liste, et faire lever `creer_facture()` une exception si `total_ht > montant_evaluation` sans réévaluation postérieure.

### 3. La garantie annoncée sur la facture exclut la main-d'œuvre 🔴

`app/factures/[id]/page.tsx:207` et `app/api/envoyer-facture/route.ts:191` — les deux impriment « **Pièces garanties** X mois ou Y km ».

La garantie légale québécoise porte sur les pièces **et** la main-d'œuvre (PRD §4.3). Le commit « Retirer la mention de garantie sur la main-d'œuvre des factures » n'a pas retiré une mention facultative : il a transformé la mention obligatoire « caractéristiques de la garantie » (§4.2) en une mention **fausse et restrictive**.

**Ce qui se passe :** plaquettes + 2,5 h de pose. Six semaines plus tard le montage siffle à cause de la pose. Le client relit sa facture, y lit que seules les pièces sont garanties, et paie une deuxième main-d'œuvre à laquelle il a droit gratuitement. La facture sert de preuve contre le garage.

**Correctif :** « Pièces et main-d'œuvre garanties X mois ou Y km, selon la première échéance atteinte. »

### 4. La facture envoyée par courriel omet trois mentions obligatoires 🔴

`app/api/envoyer-facture/route.ts` — ce courriel **est** la facture : aucune pièce jointe, aucun lien vers le document. Vérifié par recherche dans le fichier : `adresse` n'apparaît que pour le garage (ligne 149), `plaque` et `kilometrage` n'apparaissent **nulle part**.

Manquent, par rapport au PRD §4.2 : **adresse du client**, **immatriculation du véhicule**, **relevé du compteur kilométrique**. Les numéros d'inscription TPS/TVQ du garage manquent aussi.

**Correctif :** aligner le gabarit courriel sur `app/factures/[id]/page.tsx`, qui, lui, est complet.

### 5. Un mécanicien peut rouvrir un bon déjà facturé 🔴

`supabase/migrations/2026-08-12_...sql:38` — le trigger `proteger_autorisation_bon()` ne bloque que la transition **vers** `autorise`. Aucun contrôle sur les reculs.

```js
await s.from('bons_travail').update({ statut: 'en_cours' }).eq('id', BON);   // passe
await s.from('bon_travail_lignes').update({ prix_unitaire: 0 })…             // verrou rouvert
await s.from('bons_travail').update({ statut: 'termine' })…                  // passe
```

Le verrou de `bon_travail_lignes` posé le 18 août est évalué sur le **statut courant du bon** : reculer le statut le rouvre intégralement. La facture, elle, reste gelée. Les deux documents divergent en silence — précisément ce que cette migration prétendait fermer, mais elle a verrouillé la table fille, pas le statut du parent.

**Aggravation trouvée à la vérification :** l'aller-retour `en_cours → termine` **re-déclenche le décrément de stock**. Chaque cycle retire à nouveau les pièces de l'inventaire.

### 6. Une quantité négative permet d'écrire n'importe quoi dans l'inventaire 🔴

`bon_travail_lignes.quantite` (`schema.sql:214`) n'a **aucune contrainte de signe** — vérifié par recherche sur tout `supabase/`. Et `decrementer_stock_bon()` (`2026-08-14_decrement_stock.sql`) est `security definer`, donc s'exécute hors RLS.

Un mécanicien insère une ligne pièce à `quantite = -99999` liée à une pièce d'inventaire, marque le bon terminé, et `inventaire.quantite` bondit de 99 999 — alors que la RLS lui interdit formellement toute écriture sur cette table. Une quantité positive énorme donne symétriquement des stocks profondément négatifs. La colonne générée `stock_bas` suit, donc les alertes de réapprovisionnement sont manipulables aussi.

### 7. La réception peut supprimer une facture émise, sans trace 🔴

`schema.sql:427` — `factures_write_admin_reception` est en `for all`, ce qui **inclut `delete`**. Aucun trigger `before delete` sur `factures` : `proteger_montants_facture()` est en `insert or update` seulement, il ne voit jamais une suppression.

Toute la mécanique d'immuabilité comptable (annulation tracée, motif obligatoire, `annuler_facture()` réservée à l'admin) est contournée par un `delete`. Pire : l'index unique `idx_factures_bon_travail_uniq` se libère, et comme la réception peut aussi écrire `bons_travail`, elle peut remettre le bon à `termine` et **réémettre une facture à un autre montant** sans qu'aucune trace de la première ne subsiste. Même défaut sur `facture_lignes`.

---

## Correctifs SQL — prêts à coller

Ces quatre instructions ferment les points 5, 6 et 7, plus deux constats de la section suivante. À passer dans une migration datée (règle 5 du PLAN), pas dans `schema.sql`.

```sql
-- Ferme le point 5 (recul de statut) et la falsification de renonciation_ecrite
create or replace function proteger_autorisation_bon()
returns trigger as $$
begin
  if (
    (new.statut = 'autorise' and old.statut <> 'autorise')
    or new.montant_evaluation    is distinct from old.montant_evaluation
    or new.evaluation_acceptee_le is distinct from old.evaluation_acceptee_le
    or new.renonciation_ecrite   is distinct from old.renonciation_ecrite
    or (old.statut in ('termine','facture','annule')
        and new.statut is distinct from old.statut)
  ) and not est_role('admin','reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent autoriser, réévaluer ou rouvrir un bon de travail.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Ferme le point 6
alter table bon_travail_lignes
  add constraint bon_travail_lignes_quantite_positive check (quantite > 0);

-- Ferme le point 7 : plus aucune policy delete = refus par défaut
drop policy "factures_write_admin_reception" on factures;
create policy "factures_insert_admin_reception" on factures
  for insert with check (est_role('admin','reception'));
create policy "factures_update_admin_reception" on factures
  for update using (est_role('admin','reception')) with check (est_role('admin','reception'));

drop policy "facture_lignes_write_admin_reception" on facture_lignes;
create policy "facture_lignes_insert_admin_reception" on facture_lignes
  for insert with check (est_role('admin','reception'));
```

> **Avant d'appliquer la contrainte de quantité :** vérifie qu'aucune ligne existante n'est à 0 (`select count(*) from bon_travail_lignes where quantite <= 0;`). Si oui, `add constraint ... not valid` puis `validate constraint` après nettoyage.

---

## Élevé — à corriger cette semaine

| # | Constat | Où |
|---|---|---|
| 8 | **Paiement perdu entre deux postes.** `montant_paye + montantRecu` est calculé en JavaScript depuis un instantané chargé au montage, puis écrase la colonne. Deux postes qui encaissent la même facture : un des deux paiements disparaît, sans message. | `app/factures/page.tsx:362` |
| 9 | **Modifier une pièce annule le décrément de stock.** Le formulaire d'édition renvoie toujours `quantite` depuis l'instantané ouvert dans la modale. Corriger un prix de vente pendant qu'un bon se termine remet le stock à sa valeur d'avant la pose. | `components/forms/FormulaireInventaire.tsx:62` |
| 10 | **`accepter_evaluation()` fige un montant que personne n'a vu.** La fonction relit le total *au moment de l'exécution* ; le bouton affiche le total chargé *au montage*. Si le mécanicien ajoute une ligne pendant l'appel téléphonique, le montant figé n'est ni celui affiché ni celui accepté par le client. | `2026-08-16_reevaluation_complementaire.sql:48` |
| 11 | **Les fonctions d'évaluation n'ont aucune garde de statut.** `accepter_evaluation()` et `renoncer_evaluation()` ne vérifient que le rôle. Rejouées sur un bon `facture`, elles le repassent en `autorise` — ce qui rouvre les lignes d'un bon dont la facture est gelée. La fonction sœur `reevaluer_bon()` vérifie le statut : c'est un oubli, pas un choix. | idem `:38-61` et `2026-08-12_…:10-26` |
| 12 | **`renonciation_ecrite` modifiable par le mécanicien.** Le trigger ne surveille pas cette colonne. Un `update` direct suffit à faire imprimer « renonciation écrite obtenue, document manuscrit signé conservé au dossier » sur un document légal. *(Le correctif SQL ci-dessus le ferme.)* | `schema.sql:397` |
| 13 | **La réévaluation aligne le plafond sur le dépassement.** `reevaluer_bon()` ne prend pas le nouveau montant en paramètre : elle lit le total courant. Personne ne saisit ce que le client a accepté, rien n'est conservé (ni date d'appel, ni nom, ni mode d'acceptation). Le bouton est libellé « Enregistrer la réévaluation complémentaire (620,00 $) ». C'est une régularisation à sens unique, pas une nouvelle acceptation. | `2026-08-16_…:70-100` |
| 14 | **Rapport annuel tronqué en silence.** Ni `.limit()` ni pagination — vérifié, aucune des deux n'apparaît dans le fichier. Au-delà de 1000 factures dans l'année, PostgREST tronque sans erreur : le document remis au comptable annonce un CA inférieur à la réalité et affirme « 1000 facture(s) émise(s) ». Latent aujourd'hui, il se déclenchera tout seul. | `app/factures/rapport-annuel/page.tsx` |
| 15 | **Désactiver un compte ne désactive rien.** `profiles.actif` n'est consulté par aucune policy ni par le middleware — uniquement pour filtrer des menus déroulants. Un employé congédié garde tous ses droits, et peut même se remettre `actif = true` lui-même. La seule vraie révocation est la suppression dans la console Supabase. | `schema.sql:328`, `middleware.ts:34` |
| 16 | **À vérifier dans la console : l'inscription publique.** Le trigger `handle_new_user()` crée un profil `mecanicien` pour tout nouveau compte `auth.users`. Si « Enable signups » est actif côté Supabase, n'importe qui s'inscrit et lit toute la base clients. Le dépôt ne peut pas trancher — c'est une case dans le tableau de bord. **Va la vérifier.** | `schema.sql:48` |

---

## Moyen

**Documents et conformité**

- **Horodatages imprimés en UTC.** Cinq endroits font `.slice(0, 10)` sur un `timestamptz` : la renonciation et l'historique d'évaluation sur le **document imprimé**, l'envoi et l'annulation sur la facture. Une renonciation signée le 14 juillet à 20 h 30 s'imprime « 15 juillet ». C'est le bug D18, déplacé des colonnes `date` vers les horodatages.
- **`current_date` (UTC) dans les fonctions d'évaluation.** `evaluation_valide_jusqu_au = current_date + jours` : une acceptation après 20 h datera la validité du lendemain. La migration de facturation passe justement `p_date` depuis `todayLocal()` pour cette raison — les fonctions d'évaluation n'ont pas reçu la correction.
- **La renonciation ne laisse aucune trace.** Ni date de signature, ni emplacement d'archive, ni téléversement, ni **qui** l'a enregistrée. La date imprimée est `evaluation_acceptee_le`, une colonne détournée de son sens. Et comme la renonciation laisse `montant_evaluation` à `null`, le bandeau de dépassement ne peut plus jamais s'allumer : un clic supprime tout plafond de prix, sans preuve.
- **Facturation « sans taxe » sans motif.** Un booléen, rien d'autre : pas de motif, pas de numéro d'exemption, pas d'identité. Le comptoir supprime 14,975 % de taxes d'un clic, la valeur est figée et remonte au rapport annuel sous une colonne « Oui ». En cas de vérification fiscale, rien ne justifie l'exemption.
- **`etat_piece` pré-rempli à « Neuve ».** Le sélecteur est `required`, mais une valeur est déjà choisie : la contrainte est satisfaite sans que personne n'ait décidé. Une pièce usagée est déclarée neuve sur l'évaluation **et** sur la facture par simple inattention — or c'est exactement la mention que la loi rend obligatoire. Une option vide règle le problème.
- **L'évaluation n'annonce qu'un prix hors taxes.** Le « prix total » exigé est celui que le client va débourser : 480 $ annoncés, 551,88 $ facturés. Corollaire : le seuil des 100 $ est lui aussi évalué hors taxes, donc 95 $ HT (109 $ TTC) ne déclenche aucune demande d'évaluation écrite.
- **Adresse client, adresse garage et immatriculation sont facultatives** dans les formulaires, et rendues conditionnellement dans les documents. Un client sans adresse produit une facture où le champ disparaît silencieusement — aucune alerte.
- **Numéros TPS/TVQ absents de la facture.** Ils figurent sur l'évaluation et le rapport annuel, mais pas sur le seul des trois documents où ils sont exigés. Un client-entreprise ne peut pas réclamer ses CTI/RTI.
- **La date de l'évaluation est `bon.ouvert_le`** — la date d'ouverture du bon, pas celle du chiffrage. Un bon ouvert lundi et chiffré jeudi s'imprime « lundi ».
- **La garantie est paramétrable sans plancher légal.** Saisir 1 mois / 2 000 km est accepté, figé sur chaque facture et imprimé au client.
- **L'indicateur de garantie utilise les paramètres courants**, pas ceux figés sur la facture. Baisser la garantie en paramètres fait rétroactivement « expirer » des réparations dont la facture papier annonce autre chose.

**Justesse du code**

- **Recherche cassée par une virgule.** `nettoyerTerme()` existe et est appliqué sur les clients — mais pas sur l'inventaire ni sur les véhicules en stock. Taper « plaquette, avant » renvoie une erreur 400 avalée, et l'écran affiche « Aucune pièce » alors que l'inventaire en contient 200.
- **Deux bons de travail possibles pour le même rendez-vous.** `rendez_vous_id` n'a ni index unique ni vérification, contrairement à `factures.bon_travail_id`. Un double clic ou deux postes suffisent.
- **Le badge temps réel ne redescend jamais.** Le code teste `payload.old?.statut`, mais Supabase ne renvoie que la clé primaire dans `payload.old` sans `replica identity full` — vérifié, la migration ne le pose pas. Le poste A voit le badge tomber, le poste B reste à « 1 » jusqu'au rechargement complet.
- **Photos supprimées avant enregistrement.** Le fichier est effacé du bucket immédiatement ; annuler le formulaire laisse une image cassée définitive. Symétriquement, les photos téléversées puis abandonnées restent orphelines.
- **Diagnostic et notes écrasés entre deux postes.** `onBlur` envoie le champ entier depuis un instantané local, et les `textarea` en `defaultValue` ne se resynchronisent jamais. Ce que la réception a écrit pendant que la tablette était ouverte disparaît sans conflit.
- **Validation d'une demande d'accueil non atomique.** Trois écritures enchaînées sans transaction : si la plaque est en double, le client est déjà créé et la demande reste « nouvelle » → doublon au second essai.
- **Erreurs de lecture avalées sur l'écran du bon.** Aucune des cinq requêtes ne récupère `error`. Une micro-coupure Wi-Fi en atelier affiche « Total HT 0,00 $ » et « Accepter l'évaluation (0,00 $) » sans le moindre signe d'échec. Combiné au point 10, un clic fige alors n'importe quoi.
- **Écritures sans vérification d'erreur** sur le changement de statut d'un véhicule en stock, la suppression d'une ligne, et la trace d'envoi de facture (la route répond `ok: true` même si la trace n'est pas écrite).
- **`/factures/rapport-annuel` sans garde de rôle.** Un mécanicien qui tape l'URL obtient le CA annuel complet. Mais la cause racine est en base : `factures_select_all` autorise tout compte authentifié à lire toutes les factures — ajouter une garde sur la page seule serait cosmétique.
- **Neuf fonctions `security definer` sans `set search_path`.** Aucun scénario d'exploitation démontrable sur un projet Supabase récent ; c'est du durcissement, conforme à l'avertissement du linter Supabase.
- **Bucket de photos sans `allowed_mime_types` ni limite de taille**, avec le nom de fichier brut dans le chemin. Un compte admin/reception peut y déposer un `.html` servi publiquement depuis le domaine du projet.
- **`demandes_accueil` : `insert with check (true)`** sans contrainte, sans limitation de débit, sur une table publiée en temps réel. La borne QR est un choix assumé, mais rien n'empêche d'insérer 50 000 lignes, ni d'insérer directement avec `statut: 'traitee'` pour qu'une demande n'apparaisse jamais.

---

## Faible

- **Un cent d'écart entre le bon et la facture.** La vue arrondit la somme globale une fois ; `creer_facture()` arrondit pièces et main-d'œuvre séparément avant d'additionner. 46,48 $ sur le bon, 46,49 $ sur la facture — un cent au-dessus de l'évaluation acceptée.
- **`Date.UTC(y, m - 1 + mois, d)`** reporte le débordement : une facture du 30 novembre + 3 mois donne le 2 mars au lieu du 28 février. Deux jours de garantie offerts par erreur, sur un document contractuel.
- **Une quantité de 0 devient 1** (`Number(x) || 1`). Sur une pièce à 249 $, la ligne passe de 0 à 249 $ sans que l'opérateur voie autre chose que sa saisie. Même motif sur les paramètres de garantie, où vider le champ réécrit 3.
- **Montant de paiement négatif accepté** : le `min="0"` du champ n'est jamais appliqué (pas de soumission de formulaire) et aucune contrainte `check` n'existe en base.
- **Listes non paginées.** `Pagination.tsx` existe mais n'est utilisé nulle part. Au-delà de 1000 véhicules, la liste des factures affiche littéralement « Client · undefined ».
- **Double requête au montage de chaque écran de recherche**, sans annulation : si l'utilisateur tape vite, la réponse initiale peut arriver après la réponse filtrée et l'écraser.
- **Documents imprimables potentiellement périmés** — Next 14 garde le payload RSC 30 secondes ; réimprimer une évaluation juste après avoir ajouté une ligne peut ressortir l'ancienne version.
- **`pieces_a_remettre` n'apparaît sur aucun document** : le client n'est jamais informé de son droit de récupérer ses pièces.
- **Ancienne surcharge `creer_facture(uuid, date)` jamais supprimée** — surface d'API morte, source d'ambiguïté.

---

## Ce qui a été vérifié et qui tient

C'est la partie qu'il faut lire aussi. Chacun de ces points a été contrôlé dans le code, pas supposé.

- **RLS activée sur les 15 tables**, aucune oubliée, aucune policy `for all using (true)`.
- **Aucun secret exposé.** `.env.local.example` ne contient que l'URL et la clé `anon`. `service_role` n'apparaît nulle part. Les identifiants Gmail ne sont lus que côté serveur, jamais préfixés `NEXT_PUBLIC_`, jamais renvoyés dans une réponse.
- **Escalade de rôle fermée.** `protect_profile_role()` neutralise toute tentative de se donner `admin`, y compris par requête directe.
- **Pas de récursion RLS.** `est_role()` est bien `security definer`, aucune policy sur `profiles` n'interroge `profiles`.
- **Réassignation d'un bon impossible** : la policy `using` sert aussi de `with check`, un mécanicien ne peut ni s'attribuer le bon d'un autre ni s'en délester.
- **Double facturation impossible** : `creer_facture()` exige `termine`, et l'index unique partiel bloque la course entre deux postes.
- **Numérotation sans doublon** : séquences Postgres + colonnes `unique` pour BT et FA.
- **Factures gelées en modification** : 16 colonnes engageantes protégées par trigger ; la correction passe par `annuler_facture()`, admin seulement, motif obligatoire, annulation tracée. *(Le trou est le `delete`, point 7.)*
- **Route `/api/envoyer-facture` correctement gardée** : authentification **et** rôle vérifiés, destinataire dérivé du client sous RLS (pas un champ de la requête), corps HTML intégralement échappé.
- **Middleware** : `getUser()` et non `getSession()`, `matcher` couvrant `/api/**`.
- **`etat_piece` obligatoire en base** — la contrainte `etat_piece_requis` est intacte dans l'état final du schéma ; créer une ligne pièce sans état est impossible, même par appel API direct.
- **Règle de taxes appliquée à la lettre** : chaque taxe arrondie, puis somme des valeurs déjà arrondies. TPS 5 % et TVQ 9,975 % toutes deux sur le montant avant taxes. Taux copiés sur la facture à l'émission.
- **Garantie légale : le « OU » est correctement traité** — les deux conditions doivent tenir, la couverture cesse à la première échéance atteinte.
- **Le bug D18 historique est corrigé** sur les colonnes `date` : `lib/dates.ts` est juste et le tableau de bord, les rendez-vous, `ouvert_le`, `ferme_le` et la date de facture passent tous par `todayLocal()`.
- **Abonnement temps réel correctement nettoyé** au démontage — pas de fuite, pas d'abonnements empilés.
- **Double soumission impossible** : tous les boutons d'écriture sont désactivés pendant l'envoi.
- **Facture — mentions présentes** : date de livraison, relevé du compteur figé, état de chaque pièce, main-d'œuvre en heures × taux = coût avec sous-total, taxes détaillées.
- **Évaluation — mentions présentes** : coordonnées du garage avec TPS/TVQ, identité du client, véhicule complet, plainte + diagnostic, état de chaque pièce, durée de validité, rappel du caractère liant. Les notes internes ne sont jamais imprimées.
- **Séparation pièces / main-d'œuvre** respectée de bout en bout.

---

## Constats écartés à la vérification

La passe adverse en a réfuté ou dégonflé plusieurs. Pour mémoire :

- « Le mécanicien peut éteindre le garde-fou des 100 $ » — **réfuté en partie.** Il peut bien écrire `renonciation_ecrite`, mais ce « garde-fou » n'a jamais existé ailleurs que dans un bandeau d'affichage : il ne désactive aucun bouton et ne bloque aucune transition. L'impact réel est la falsification d'une mention légale, pas une escalade.
- « Injection d'en-têtes courriel » — **non démontrée.** Les deux valeurs interpolées sont écrites par admin/reception seulement, et Nodemailer assainit les en-têtes.
- « Le `security definer` de `decrementer_stock_bon` est le défaut » — **déplacé.** C'est une fonction trigger, non appelable directement ; le vrai défaut est l'absence de contrainte de signe sur `quantite`.
- « Double décrément de stock au double clic » — **réfuté.** La condition `when (new.statut = 'termine' and old.statut = 'en_cours')` y résiste. *(Le double décrément réel passe par le recul de statut, point 5.)*

---

## Ordre de travail suggéré

1. **Aujourd'hui** — les quatre instructions SQL de la section « prêts à coller » (points 5, 6, 7, 12), puis vérifier « Enable signups » dans la console Supabase (point 16).
2. **Avant la prochaine facture émise** — points 1 à 4 : les quatre documents légaux qui affichent la mauvaise donnée. Ce sont des correctifs d'affichage, rapides.
3. **Cette semaine** — points 8 à 11 : les courses entre deux postes, qui font perdre de l'argent et des données sans rien afficher.
4. **Ensuite** — la section « Moyen », en commençant par les horodatages UTC sur les documents imprimés et la trace de la renonciation.
5. **Et enfin** — activer les sauvegardes Supabase (tâche 9.5, toujours en pause) et dérouler la tâche 5.13 avec un vrai compte mécanicien. Les correctifs SQL ci-dessus changent justement ce que ce compte peut faire : c'est le bon moment pour tester.

---

*Audit produit par lecture du code source uniquement. Aucune exécution contre la base de production, aucun test d'intrusion réel. Les scénarios décrits sont déduits du code et n'ont pas été exécutés. Pour les points de conformité, faire valider par un conseiller juridique ou directement auprès de l'OPC avant de s'appuyer sur ce document.*
