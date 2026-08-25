# MECAFORCE — PLAN d'exécution

**Version :** 1.0 — 12 août 2026
**Statut :** proposition, en attente de validation
**Objectif V1 :** plus aucun bon de travail papier, historique complet par véhicule

---

## Comment lire ce plan

Le travail est découpé en **lots**. Chaque lot se termine par quelque chose que
tu peux **ouvrir et utiliser** — aucun lot ne produit uniquement de la
plomberie invisible.

Chaque tâche est cochable. Les estimations sont indicatives et supposent qu'on
travaille ensemble par sessions.

**Règle absolue :** un commit Git à la fin de chaque tâche. C'est ce qui garantit
que le problème du 11 août ne se reproduit jamais.

---

## Lot 0 — Sécuriser les fondations 🔴

*Rien d'autre ne commence avant que ce lot soit terminé.*

- [x] **0.1** Créer le dossier du projet sur le Bureau : `~/Desktop/mecaforce/`
- [ ] **0.2** Vérifier l'état du projet Supabase précédent — *non vérifié,
      décision prise directement (voir 0.3)*
- [x] **0.3** Selon 0.2 : réutiliser la base existante, ou créer un projet
      neuf → **décidé le 12 août : projet neuf**, sans réutiliser l'ancien
- [x] **0.4** `git init` + premier commit
- [x] **0.5** Dépôt **GitHub privé** + `git push` →
      [`sidbelkhiri-dotcom/mecaforce`](https://github.com/sidbelkhiri-dotcom/mecaforce)
- [x] **0.6** `.gitignore` vérifié : `.env.local`, `node_modules`, `.next` exclus
- [x] **0.7** Poser `docs/PRD.md`, `docs/PLAN.md`, `docs/DESIGN.md` dans le dépôt et committer
- [x] **0.8** `README.md` — porte d'entrée du dépôt

**Livrable :** un dépôt GitHub privé contenant la documentation. Le projet ne
peut plus disparaître.

---

## Lot 1 — Socle applicatif

- [x] **1.1** `create-next-app` : TypeScript strict, Tailwind, App Router, alias `@/*`
- [x] **1.2** Dépendances : `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`
- [x] **1.3** `lib/supabase/{client,server}.ts` + `middleware.ts` (garde d'auth)
- [x] **1.4** `.env.local.example` + `.env.local`
- [x] **1.5** Écrire `supabase/schema.sql` complet (DESIGN §5) et l'exécuter
  - [x] 8 tables reprises + `bons_travail` + `bon_travail_lignes`
  - [x] Contraintes `check` sur tous les statuts (D19)
  - [x] Index, dont les uniques partiels sur `plaque` et `vin`
  - [x] Triggers `updated_at` (D20)
  - [x] Vue `bons_travail_totaux` en `security_invoker = true`
  - [x] Fonction `est_role()` + **RLS par rôle** `admin` / `reception` / `mecanicien` (D22)
  - [x] Fonction `accepter_evaluation()` en `security definer` (D23)
  - [x] `profiles` en lecture ouverte, avec trigger anti-auto-promotion (D24)
  - [x] **Exécuté sur `giabayiwjxrghitzmrfl.supabase.co`** — vérifié par requête REST
- [x] **1.6** `lib/database.types.ts` (D14) — écrit à la main depuis
      `schema.sql`/`migrations/` faute d'accès CLI (mot de passe DB ou
      `supabase login` non disponibles dans cet environnement) ; à
      régénérer avec la vraie commande dès que l'un des deux l'est. Pas
      encore câblé dans `lib/supabase/{client,server}.ts` — délibérément,
      pour ne rien risquer sur une app déjà en production
- [x] **1.7** `app/login/page.tsx` + **bouton de déconnexion**
- [x] **1.8** `app/layout.tsx` + `components/Sidebar.tsx` — **seules les routes
      existantes apparaissent dans le menu** (C1)
- [x] **1.9** `lib/dates.ts` — helpers `America/Toronto` (D18)
- [x] **1.10** Vérification : `npm run dev`, connexion, déconnexion, redirections
      — testé dans le navigateur avec un vrai compte (`sidbelkhiri@gmail.com`, admin)

**Livrable :** on se connecte, on se déconnecte, la navigation ne ment pas.

---

## Lot 2 — Composants réutilisables

*Petit lot, énorme effet de levier. Tout le reste s'appuie dessus.*

- [x] **2.1** `components/ui/` : `Champ`, `Selecteur`, `Bouton`, `Modale`,
      `Tableau`, `Badge`, `EtatVide`, `Chargement`, `MessageErreur`
- [x] **2.2** Hook de formulaire : validation, état d'envoi, **affichage des
      erreurs Supabase** (D15, I4)
- [x] **2.3** Composant de recherche serveur (`.ilike()` + anti-rebond)
- [x] **2.4** Modale de confirmation de suppression (jamais `confirm()`)
- [x] **2.5** Vérification responsive : tester chaque composant à 375 px,
      768 px, 1440 px. Cibles tactiles ≥ 44 px (D17) — **a trouvé et corrigé
      un vrai défaut** : la barre latérale rendait le contenu illisible sous
      768 px, remplacée par une barre du haut + tiroir

**Livrable :** une bibliothèque de composants qui rend chaque page suivante deux
fois plus rapide à écrire.

---

## Lot 3 — Clients et véhicules

- [x] **3.1** `/clients` — liste, recherche serveur, création, modification
- [x] **3.2** `/clients/[id]` — fiche client + liste de ses véhicules
- [x] **3.3** Formulaire véhicule (marque, modèle, année, plaque, VIN, couleur)
- [x] **3.4** `/vehicules/[id]` — fiche véhicule (l'historique arrive au **lot 7**,
      pas 5 — corrigé ici, voir le Lot 7 plus bas)
- [x] **3.5** Recherche globale par nom, téléphone, **plaque** et **VIN**
- [x] **3.6** Vérification : créer 3 clients avec véhicules, tester la plaque en
      double (doit être refusée), tester la suppression en cascade — les trois
      testés dans le navigateur, données de test nettoyées ensuite

**Livrable :** le fichier clients du garage vit dans l'application. F1, F2, I5 réglés.

---

## Lot 4 — Rendez-vous

- [x] **4.1** `/rendez-vous` — vue **jour**
- [x] **4.2** Vue **semaine**
- [x] **4.3** Création : client → véhicule → date, heure, durée, motif, mécanicien
- [x] **4.4** Changement de statut (prévu / confirmé / en cours / terminé / annulé / absent)
- [x] **4.5** Filtre par mécanicien
- [x] **4.6** Vérification : créer un RDV à 21 h un soir d'été, confirmer qu'il
      apparaît bien le bon jour (**test de non-régression du bug UTC**, J3/D18) —
      testé le 12 août (jour réel, été) dans le navigateur : le RDV reste sur
      le 12, pas le 13

**Livrable :** le planning de l'atelier. F3 réglé.

---

## Lot 5 — Bons de travail 🎯

*Le cœur de la V1. Le lot le plus important du plan.*

- [x] **5.1** `/bons-travail` — file des bons ouverts, filtrable par mécanicien et statut
- [x] **5.2** Création depuis un RDV **ou** directement (client, véhicule,
      **kilométrage obligatoire**, plainte du client)
- [x] **5.3** `/bons-travail/[id]` — **écran tablette**. La conception démarre
      par la maquette 768 px, pas par le bureau
- [x] **5.4** Saisie du diagnostic
- [x] **5.5** Ajout de lignes **pièce** : description, **état obligatoire**
      (neuve / usagée / réusinée / remise à neuf), quantité, prix — *lien vers
      l'inventaire non fait : l'inventaire n'existe pas encore (Lot 8)*
- [x] **5.6** Ajout de lignes **main-d'œuvre** : description, heures, taux
      horaire prérempli depuis le bon (figé à la création, D13)
- [x] **5.7** Sous-totaux pièces / main-d'œuvre / total, en direct
- [x] **5.8** Cycle de vie : évaluation → autorisé → en cours → terminé
- [x] **5.9** **Bandeau rouge de dépassement d'évaluation** (PRD §4.1)
- [x] **5.10** Indicateur « pièces remplacées à remettre au client »
- [x] **5.11** Notes internes, non imprimées
- [x] **5.12** Vérification : dérouler le parcours P2 → P6 du PRD en entier, sur
      tablette, avec un vrai véhicule — testé dans le navigateur à 768 px avec
      un vrai client/véhicule : création, diagnostic, ligne pièce (état
      obligatoire vérifié), ligne main-d'œuvre, acceptation de l'évaluation,
      dépassement déclenché puis résolu, démarrage, terminaison
- [ ] **5.13** Vérification des rôles : connecté en `mecanicien`, confirmer qu'on
      **ne peut pas** accepter une évaluation ni créer un client (PRD §1.1) —
      **vérifié par lecture de code/RLS/trigger** (D25), pas par un vrai compte
      `mecanicien` en direct : l'inscription publique via l'API a buté sur la
      validation de courriel de Supabase. À refaire pour de vrai dès qu'un
      premier compte mécanicien existera

**Livrable :** le bon de travail papier n'est plus nécessaire. F4 réglé.

---

## Lot 6 — Évaluation écrite conforme

- [x] **6.1** Mise en page imprimable de l'évaluation, avec **toutes** les
      mentions obligatoires (PRD §4.1) : identités et adresses des deux parties,
      caractéristiques du véhicule, description des travaux, **état de chaque
      pièce**, prix total, date, **durée de validité**
- [x] **6.2** Impression navigateur + export PDF — bouton qui appelle
      `window.print()` ; la boîte de dialogue du navigateur propose déjà
      « Enregistrer en PDF », aucune bibliothèque séparée nécessaire
- [x] **6.3** Acceptation : **fige** `montant_evaluation` et
      `evaluation_acceptee_le`, calcule `evaluation_valide_jusqu_au` — déjà fait
      par `accepter_evaluation()` au Lot 1, revérifié en direct au Lot 5
- [x] **6.4** Indicateur de renonciation écrite (document manuscrit obtenu et
      archivé) — **jamais** une simple case à cocher tenant lieu de renonciation
- [x] **6.5** Alerte automatique dès que les travaux dépassent 100 $ sans
      évaluation acceptée ni renonciation
- [x] **6.6** Vérification : relire le document imprimé mention par mention
      contre la page de l'OPC — chaque mention confirmée présente à l'écran
      avec de vraies données (client, véhicule, pièce à l'état « Neuve »,
      prix, date, validité) ; **l'adresse du garage reste vide** tant que
      `/parametres` n'existe pas (Lot 8) pour la renseigner

**Livrable :** conformité réglementaire sur les travaux > 100 $. F5 réglé.

---

## Lot 7 — Historique et garantie

- [x] **7.1** `/vehicules/[id]` — tous les bons de travail, date décroissante,
      avec kilométrage et travaux
- [x] **7.2** Progression du kilométrage entre les visites
- [x] **7.3** **Indicateur de garantie** : une réparation est-elle encore dans
      les 3 mois / 5 000 km ? (PRD §4.3, paramétrable)
- [x] **7.4** Historique aussi visible depuis la fiche client
- [x] **7.5** Vérification : dérouler les parcours P7 et P8 du PRD — testé
      dans le navigateur avec un vrai véhicule (148 000 km → 158 000 km →
      161 000 km, comme l'exemple du PRD) : garantie correcte sur les deux
      bons terminés (un expiré par date, un couvert), progression affichée,
      historique visible sur la fiche véhicule **et** la fiche client.
      **Trouvé et corrigé en testant : D26**, `ouvert_le` prenait le défaut
      `current_date` du serveur Postgres (UTC), le même piège que D18
      déplacé à la base de données — corrigé en le passant explicitement
      depuis l'app

**Livrable :** « qu'est-ce qu'on lui a fait la dernière fois ? » répondu en
15 secondes. F6 réglé.

---

## Lot 8 — Inventaire et paramètres

- [x] **8.1** `/inventaire` — CRUD, référence, prix d'achat, prix de vente,
      quantité, seuil, fournisseur — testé en direct (créer/modifier/supprimer)
- [x] **8.2** Alerte stock bas **calculée en SQL**, plus en JavaScript — colonne
      générée `stock_bas` (migration D27, pas encore appliquée sur le vrai
      projet — dégradation propre en attendant : simplement pas d'alerte)
- [x] **8.3** `/parametres` — coordonnées, TPS/TVQ, **taux horaire**, validité
      des évaluations, garantie — testé en direct, taux horaire enregistré
- [x] **8.4** Accès aux paramètres réservé au rôle `admin` (PRD §1.1) — garde
      **côté serveur** (redirection avant l'affichage, pas un bouton caché)
- [x] **8.5** Écran d'assignation des rôles, réservé à l'administrateur —
      **a nécessité D27** (voir DESIGN.md) : sans cette policy, même un admin
      ne pouvait changer le rôle de personne d'autre que lui-même. Protection
      anti-auto-changement de rôle vérifiée (sélecteur désactivé côté UI, D24
      côté base)

**Livrable :** F7 et F8 réglés. Les quatre 404 ont disparu.

---

## Lot 9 — Tableau de bord et finitions

- [x] **9.1** Tableau de bord refait : RDV du jour, **véhicules actuellement à
      l'atelier**, bons en attente d'autorisation, alertes de stock — testé en
      direct, un bogue trouvé et corrigé (requête sur une colonne inexistante)
- [x] **9.2** Vérification responsive complète sur les trois formats — faite
      progressivement à chaque lot plutôt qu'en une seule passe à la fin ;
      revérifiée ici pour le tableau de bord et les corrections du 9.3
- [x] **9.3** Passe d'accessibilité : contrastes, navigation clavier, libellés
      — **D28/D29** (contrastes calculés, pas devinés) + lignes de tableau
      rendues focusables/opérables au clavier, vérifié à la main (Tab, Entrée)
- [x] **9.4** Déploiement Vercel + variables d'environnement — en production sur
      `mecaforce.vercel.app`, vérifié (connexion, dernière version déployée)
- [x] **9.5** Sauvegarde — workflow GitHub Actions (`sauvegarde-supabase.yml`)
      qui exporte la base chaque dimanche 8h UTC sur la branche `backups`.
      Trois vrais bugs distincts trouvés et corrigés en testant en direct
      (run #9 vert, `backup-2026-08-16.sql` confirmé sur `backups`) — D35
      dans DESIGN.md
- [x] **9.6** Mettre à jour `DESIGN.md` — journal de décisions à jour (D24-D29
      documentées au fil de l'eau, pas à la fin)

**Livrable :** V1 en production, utilisable par toute l'équipe.

---

## Après la V1

| Version | Contenu | Déclencheur |
|---|---|---|
| **V2 — Facturation** | 🟢 **fait le 2026-08-13** : facture générée depuis le bon de travail terminé (montants et taxes figés, D31), imprimable/PDF, paiements et paiements partiels. Reste hors périmètre : décrément automatique du stock | — |
| **V3 — Fidélisation** | Rappels d'entretien par date et kilométrage, notifications courriel/SMS | Quand l'historique contient assez de données pour être utile |
| **V4 — Gestion** | Fournisseurs, commandes, marges, rapports de CA et de taxes, heures vendues par mécanicien | Quand la V2 tourne depuis un trimestre complet |

---

## Règles de travail

1. **Un commit par tâche.** Message en français, à l'impératif.
2. **Aucune tâche cochée sans vérification manuelle.** Ouvrir la page, cliquer, tester.
3. **Le responsive se teste à chaque lot**, pas à la fin.
4. **Toute décision technique va dans le journal de `DESIGN.md`**, le jour même.
5. **Toute évolution de schéma passe par un fichier de migration daté** dans
   `supabase/migrations/`, jamais par une modification directe de `schema.sql`
   après le lot 1.
6. **Si un lot déborde, on livre ce qui marche et on reporte le reste** — on ne
   laisse jamais une page à moitié faite dans le menu.

---

## Suivi

| Lot | Statut | Terminé le |
|---|---|---|
| 0 — Fondations | 🟢 terminé | 2026-08-12 |
| 1 — Socle | 🟢 terminé | 2026-08-12 |
| 2 — Composants | 🟢 terminé | 2026-08-12 |
| 3 — Clients / véhicules | 🟢 terminé | 2026-08-12 |
| 4 — Rendez-vous | 🟢 terminé | 2026-08-12 |
| 5 — Bons de travail | 🟢 terminé — migration D25 appliquée sur le vrai projet | 2026-08-13 |
| 6 — Évaluation écrite | 🟢 terminé — l'adresse du garage se renseigne maintenant dans `/parametres` (Lot 8) | 2026-08-12 |
| 7 — Historique / garantie | 🟢 terminé | 2026-08-13 |
| 8 — Inventaire / paramètres | 🟢 terminé — migrations D25 et D27 appliquées sur le vrai projet | 2026-08-13 |
| 9 — Tableau de bord / prod | 🟡 en production — reste 9.5 (sauvegardes, en pause) et 5.13 (revérification avec un vrai compte mécanicien) | 2026-08-13 |
