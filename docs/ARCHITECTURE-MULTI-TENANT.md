# Fondations multi-locataire pour la future plateforme (à partir de MECAFORCE)

## Contexte

MECAFORCE SERVICE est aujourd'hui l'outil de gestion d'**un seul garage**, qui lance en production le 1er septembre. Le propriétaire veut ensuite transformer ce produit en plateforme SaaS multi-garages pour le Québec (un concurrent francophone de Tekmetric), en réutilisant le travail déjà fait — le modèle de données, la conformité fiscale/légale (Loi 25, TPS/TVQ, obligation d'évaluation écrite), et le patron de sécurité RLS déjà éprouvé par un audit complet.

**Ce document est un plan d'architecture, pas du code.** Rien n'est touché sur le système de production actuel (`mecaforce`, `mecaforce-site`, projet Supabase `giabayiwjxrghitzmrfl`). Le futur produit vivra dans **un dépôt Git et un projet Supabase entièrement séparés**, initialisés à partir d'une copie de la base de code actuelle. La marque du futur produit n'est pas encore choisie — ce document l'appelle « la Plateforme ».

Ce plan a été relu et corrigé par un second passage d'architecture qui a exploré le schéma réel (`supabase/schema.sql` + 30 migrations) — les angles morts qu'il a trouvés sont intégrés ci-dessous, pas juste l'intention de départ.

## Décision d'architecture : isolation par ligne (row-level multi-tenancy)

Une seule base partagée, avec une colonne `garage_id` et des politiques RLS scopées — plutôt qu'une base par tenant (surcoût opérationnel disproportionné pour une petite équipe) ou un schéma par tenant (mal supporté par PostgREST, dont le `search_path` n'est pas dynamique par requête).

C'est aussi la continuité naturelle de ce qui existe déjà : `est_role()` est un patron `security definer` qu'on réplique pour `garage_actuel()`, pas un concept nouveau.

### Fonction centrale : `garage_actuel()`, pas un claim JWT

```sql
create or replace function garage_actuel()
returns uuid as $$
  select garage_id from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public, pg_temp;
```

**Toujours dérivée côté serveur, jamais un claim JWT personnalisé.** Un claim est figé au moment de l'émission du token — un employé réaffecté à un autre garage garderait l'accès à l'ancien tant que son token n'est pas rafraîchi. C'est exactement la même raison pour laquelle `est_role()` vérifie `actif` en temps réel plutôt que via un claim mis en cache.

### `garages` — nouvelle table racine du tenant

`id, nom, adresse, telephone, courriel, neq, plan_abonnement, statut ('actif'|'suspendu'|'resilie'), compteur_bt, compteur_fa, cree_le`

**`garages` n'autorise jamais de `delete` réel** — seulement un changement de `statut`. Avec les `on delete cascade` déjà en place partout, supprimer une ligne `garages` supprimerait en cascade toute la base d'un client qui pourrait avoir une obligation contractuelle de récupérer un export avant de partir.

## Ce qui doit changer, au-delà de l'évidence

L'intuition de départ (« chaque policy qui fait `using (est_role(...))` devient `using (garage_id = garage_actuel() and est_role(...))` ») est incomplète. Le vrai audit a trouvé :

1. **14 policies utilisent `auth.role() = 'authenticated'`, pas `est_role()`** — ce sont les policies de **lecture** sur `clients`, `vehicules`, `rendez_vous`, `inventaire`, `parametres`, `bons_travail`, `bon_travail_lignes`, `factures`, `facture_lignes`, `bon_travail_evaluations`, `vehicules_stock`, `ref_pieces`, et **`profiles`** lui-même. C'est la vraie surface de fuite n°1 — sans correction explicite, chaque garage continuerait de lire l'annuaire, les clients, les véhicules et les factures de tous les autres. À traiter comme une catégorie à part, avant les policies d'écriture qui utilisent déjà `est_role()`.

2. **Dénormaliser `garage_id` sur les tables filles aussi** (`bon_travail_lignes`, `facture_lignes`, `bon_travail_evaluations`), pas seulement les tables racines. Peuplé par trigger `before insert` depuis le parent, jamais modifiable après coup (même logique que `montant_evaluation` figé). Ça permet :
   - des policies en égalité simple indexable, plutôt qu'un `EXISTS` corrélé par ligne (le point de friction de performance RLS classique à volume) ;
   - des **FK composites** (`bon_travail_lignes(piece_id, garage_id) references inventaire(id, garage_id)`) — RLS protège la lecture/écriture d'une table, pas la cohérence tenant d'une clé étrangère vers une autre. Sans ça, une ligne peut référencer un `piece_id` d'un autre garage sans que RLS seule l'empêche.

3. **Numérotation par garage.** `bon_travail_numero_seq`/`facture_numero_seq` sont des séquences globales aujourd'hui — en production mutualisée, les numéros `BT-`/`FA-` de deux garages se mélangeraient dans la même suite. À corriger avant tout onboarding réel : un compteur verrouillé par garage (`select ... for update` sur `garages.compteur_fa`, même patron que `enregistrer_paiement()`), jamais une séquence Postgres dynamique par tenant.

4. **Repartitionner les index uniques globaux** (`idx_vehicules_plaque_uniq`, `idx_vehicules_vin_uniq`) en `(garage_id, upper(plaque))` — sinon le deuxième garage à enregistrer une plaque déjà vue ailleurs dans la base reçoit une erreur, et ça fuit accessoirement l'information qu'un autre garage a ce véhicule.

5. **Storage — angle mort complet, chantier séparé.** Le bucket `vehicules-stock` est public en lecture sans vérification de rôle ni de tenant, avec des chemins plats sans préfixe. Nécessite soit un préfixe de chemin (`storage.foldername(name)[1] = garage_actuel()::text`, donc un changement du format d'upload côté application), soit un bucket privé avec URLs signées scopées. Ne pas le laisser implicite dans « chaque table reçoit un garage_id » — Storage n'est pas une table.

6. **Fixer `search_path` sur les fonctions `security definer` plus anciennes** (`accepter_evaluation` d'origine, `creer_facture`, `handle_new_user`) en même temps qu'on les modifie de toute façon pour ajouter la vérification tenant.

## Super-admin plateforme

Ne pas le mélanger dans `profiles.role`/`est_role()` (qui reste `admin|reception|mecanicien`, scopé à un garage). Table séparée `plateforme_admins (user_id uuid primary key)` + fonction dédiée `est_admin_plateforme()`, même patron `security definer`. Les policies tenant-scopées qui doivent l'exposer s'écrivent `using (garage_id = garage_actuel() or est_admin_plateforme())` — n'alourdit `est_role()` en rien, et la portée du super-accès reste une décision consciente table par table, pas un contournement générique.

## Ordre de migration recommandé

1. **Fondation isolée** — `garages`, `profiles.garage_id` (nullable au départ), `garage_actuel()` avec `search_path` fixé, testée seule (un utilisateur sans profil renvoie `null`, jamais une erreur).
2. **Un seul tenant pilote d'abord** — backfiller `garage_id` sur toutes les tables (y compris les tables filles) avec l'ID du garage MECAFORCE de test, poser les FK composites, valider que rien ne casse à un seul tenant avant `not null`.
3. **Réécrire d'abord les 14 policies `SELECT` ouvertes** (`profiles`, `clients`, `vehicules`, etc.) — pas les policies d'écriture déjà scopées par `est_role()`, qui sont un risque moindre.
4. **Fonctions `security definer` critiques** (`creer_facture`, `annuler_facture`, `accepter_evaluation`, `reevaluer_bon`, `enregistrer_paiement`) — ajouter `garage_id = garage_actuel()` sur la ligne ciblée, après l'étape 3.
5. **Deuxième tenant de test + suite d'isolation** — données de test avec collisions volontaires (mêmes plaques, mêmes numéros). Suite explicite : connecté comme utilisateur du garage A, tenter `select`/`update`/`delete`/`insert` sur des IDs connus du garage B pour chaque table et fonction, zéro ligne/exception attendue. Faire tourner le Database Linter Supabase (`rls_disabled_in_public`, `security_definer_view`, `function_search_path_mutable`) comme étape automatisée de cette suite.
6. **Storage en dernier**, comme chantier explicite séparé.

## Portée du MVP (explicite)

**Dans le MVP** : l'application de gestion interne multi-tenant seulement (clients, véhicules, bons de travail, factures, inventaire, fidélité), prouvée isolée entre deux garages de test.

**Hors MVP (Phase 2+)** : site public/prise de rendez-vous par tenant, facturation SaaS (Stripe), auto-inscription, interface d'administration plateforme. Tekmetric lui-même ne construit pas le site web de ses clients — seulement l'outil de gestion.

Deux choses doivent néanmoins être posées dans le **schéma** dès le MVP, même sans être utilisées, parce qu'elles sont coûteuses à corriger rétroactivement une fois des vrais garages en production : la dénormalisation `garage_id` sur les tables filles (point 2) et le compteur de numérotation par garage (point 3) — corriger l'un ou l'autre après coup impliquerait de renuméroter ou de réécrire des factures déjà figées par la règle d'immuabilité.

## Pendant que MECAFORCE SERVICE se stabilise

Attendre avant d'**onboarder de vrais garages clients payants** ne veut pas dire attendre pour travailler. Comme la Plateforme vit dans un dépôt et une base séparés dès le départ, tout ce qui suit peut avancer en parallèle, sans aucun risque pour la production :

- Mettre en place la fondation (étapes 1 à 4 ci-dessus) et la valider avec le garage MECAFORCE lui-même comme unique tenant de test
- Construire et faire tourner la suite d'isolation (étape 5) avec des tenants synthétiques
- Corriger les angles morts identifiés (numérotation, index uniques, Storage, `search_path`) pendant qu'ils sont encore isolés d'un vrai deuxième client
- Observer MECAFORCE SERVICE en usage réel pour repérer les bugs et les angles morts qu'un audit seul ne trouve pas — ce sont exactement les choses à corriger dans la Plateforme avant d'y faire confiance avec les données d'un étranger

Le seul jalon à ne pas brûler, c'est le premier vrai garage client payant — celui-là attend que MECAFORCE SERVICE ait fait ses preuves.

## Mise en place (une fois ce plan approuvé)

- Nouveau dépôt Git, copié depuis `mecaforce` comme point de départ
- Nouveau projet Supabase de développement, distinct de `giabayiwjxrghitzmrfl`
- Aucune modification aux dépôts ou à la base de production actuels

## Vérification

- Suite d'isolation décrite à l'étape 5, à faire passer avant tout onboarding réel d'un deuxième garage
- Database Linter Supabase propre (aucun `rls_disabled_in_public`, `security_definer_view`, `function_search_path_mutable`)
- Test manuel : deux garages synthétiques, tentative d'accès cross-tenant via l'interface ET via appel RPC direct avec la clé anon

## Fichiers de référence (patrons à réutiliser depuis le code actuel)

- `supabase/schema.sql` — `est_role()`, tables racines, les 14 policies `auth.role() = 'authenticated'` à corriger en priorité
- `supabase/migrations/2026-08-16_reevaluation_complementaire.sql` — exemple de table fille sans `garage_id` propre
- `supabase/migrations/2026-08-25_paiement_atomique.sql` — patron de verrouillage de ligne à réutiliser pour le compteur par garage
- `supabase/migrations/2026-08-17_photos_vehicules_stock.sql` + `lib/vehiculesStockPhotos.ts` — bucket Storage à restructurer
- `middleware.ts` — point où ajouter un contrôle d'appartenance de route en défense en profondeur (RLS reste le vrai verrou)
