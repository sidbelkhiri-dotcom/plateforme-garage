# MECAFORCE — DESIGN (conception technique)

**Version :** 1.0 — 12 août 2026
**Statut :** proposition, en attente de validation
**Remplace :** `architecture.md` et `modele-de-donnees.md` du Projet Claude, fusionnés et corrigés ici

---

## 1. Stack

| Couche | Choix | Version |
|---|---|---|
| Framework | Next.js, App Router | 14.2.x |
| UI | React | 18.3 |
| Styles | Tailwind CSS | 3.4 |
| Icônes | lucide-react | ^0.383 |
| BDD + Auth | Supabase (PostgreSQL) | `@supabase/supabase-js` ^2.45 |
| Pont session / cookies | `@supabase/ssr` | ^0.5.1 |
| Langage | TypeScript, mode `strict` | 5.5 |
| Types BDD | générés par `supabase gen types typescript` | — |
| Hébergement | Vercel | plan gratuit |
| Contrôle de version | Git + GitHub privé | **obligatoire dès le jour 1** |

Alias d'import `@/*` vers la racine du projet.

---

## 2. Principes d'architecture

Ces décisions sont **reprises de la conception précédente** et confirmées. Elles
ne sont pas rejugées : elles sont documentées pour ne plus avoir à les
redécouvrir.

| # | Principe | Raison |
|---|---|---|
| D1 | Next.js App Router + TypeScript strict | Un seul déploiement pour le front et le rendu serveur |
| D2 | **Aucun backend séparé.** Les pages parlent directement à Supabase (PostgREST) | Supprime une couche entière à écrire et maintenir |
| D3 | **La RLS est la couche d'autorisation**, pas le code applicatif | La sécurité vit dans la base, incontournable depuis le client |
| D4 | Modèle « outil interne » : tout compte authentifié est du personnel | 2 à 4 utilisateurs de confiance |
| D5 | Pas d'inscription publique — comptes créés en console Supabase | Outil interne |
| D6 | Suppression client → cascade sur véhicules, `set null` sur documents | L'historique survit à la suppression d'une fiche |
| D7 | Totaux calculés par vue SQL, jamais stockés… | …**sauf** les montants figés par la loi (voir D13) |
| D8 | Numérotation par séquence Postgres | Unicité garantie ; trous assumés sur insert annulé |
| D9 | `parametres` en table à ligne unique | Configuration en base plutôt qu'en variables d'environnement |
| D10 | Deux modèles de page : Server Component en lecture, Client Component en CRUD | Voir §6 |
| D11 | Charte visuelle fixe | Voir §7 |
| D12 | Déploiement Vercel | Suffisant pour un garage |

### Décisions nouvelles

| # | Décision | Raison |
|---|---|---|
| **D13** | **Les montants engageants sont figés dans la table, pas recalculés.** Montant d'évaluation accepté, taux horaire appliqué, taux de taxes | La loi lie le garage au montant de l'évaluation acceptée. Un total recalculé peut changer rétroactivement — inacceptable sur un document engageant |
| **D14** | **Types TypeScript générés depuis le schéma**, jamais écrits à la main | Une seule source de vérité. `npm run types` régénère `lib/database.types.ts` |
| **D15** | **Aucun `prompt()`, `alert()` ou `confirm()`.** Formulaires réels, erreurs affichées à l'écran | Défaut majeur de la version précédente |
| **D16** | **`bon_travail_lignes` : une seule table, discriminée par `type`** (`piece` / `main_oeuvre`) | Deux tables séparées compliquent l'ordre d'affichage et le total. Le discriminant suffit, et la structure devient telle quelle celle des lignes de facture en V2 |
| **D17** | **Le responsive est une contrainte, pas une finition.** Cibles tactiles ≥ 44 px, aucune interaction dépendant du survol | Usage tablette en atelier confirmé |
| **D18** | **Toute date métier est en heure locale `America/Toronto`**, jamais en UTC brut | Bug de la version précédente : le tableau de bord basculait au lendemain à 20 h |
| **D19** | **Contraintes `check` sur tous les statuts** | Une faute de frappe ne doit pas créer un état fantôme |
| **D20** | **`updated_at` avec trigger sur toutes les tables métier** | Traçabilité minimale |
| **D21** | **Les tables `factures` / `facture_lignes` existent mais restent inutilisées en V1** | Elles sont là pour la V2. Le bon de travail est conçu pour s'y déverser sans migration |
| **D22** | **Trois rôles applicatifs — `admin`, `reception`, `mecanicien` — appliqués par la RLS** (PRD §1.1) | D3 : l'autorisation vit dans la base, pas dans le code |
| **D23** | **L'acceptation d'une évaluation passe par une fonction `security definer`**, réservée à `admin` et `reception` | La RLS ne protège pas une colonne. Figer un montant juridiquement engageant ne doit pas être possible depuis la tablette de l'atelier |

---

## 3. Arborescence

```
mecaforce/
├── docs/
│   ├── PRD.md               Quoi et pourquoi
│   ├── PLAN.md              Dans quel ordre
│   └── DESIGN.md            Ce document
├── app/
│   ├── layout.tsx           <html lang="fr">, Sidebar + <main>
│   ├── page.tsx             Tableau de bord (Server Component)
│   ├── globals.css
│   ├── login/page.tsx
│   ├── clients/
│   │   ├── page.tsx         Liste + recherche
│   │   └── [id]/page.tsx    Fiche client + ses véhicules
│   ├── vehicules/[id]/page.tsx   Fiche véhicule + historique
│   ├── rendez-vous/page.tsx      Vue jour / semaine
│   ├── bons-travail/
│   │   ├── page.tsx         File des bons ouverts
│   │   └── [id]/page.tsx    Le bon de travail (écran tablette)
│   ├── inventaire/page.tsx
│   └── parametres/page.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── ui/                  Champ, Bouton, Modale, Tableau, Badge…
│   └── forms/               Formulaires client, véhicule, RDV, ligne de bon
├── lib/
│   ├── supabase/{client.ts, server.ts}
│   ├── database.types.ts    GÉNÉRÉ — ne pas éditer à la main
│   ├── dates.ts             Helpers America/Toronto
│   └── totaux.ts            Calculs pièces / main-d'œuvre / taxes
├── supabase/
│   ├── schema.sql           Schéma complet
│   └── migrations/          Migrations incrémentales datées
├── middleware.ts
└── .env.local.example
```

**Règle :** `lib/database.types.ts` est généré. Toute modification manuelle sera
écrasée à la prochaine génération.

---

## 4. Authentification

Trois pièces qui s'articulent — inchangé, ça marchait :

**`middleware.ts`** — s'exécute avant chaque requête. `matcher` couvrant tout
sauf `_next/static`, `_next/image`, `favicon.ico`. Reconstruit un client
Supabase depuis les cookies, appelle `auth.getUser()`, puis : pas d'utilisateur
et pas sur `/login` → redirection `/login` ; utilisateur connecté visitant
`/login` → redirection `/`. Rafraîchit le jeton dans les cookies de la réponse.

**`lib/supabase/server.ts`** — pour les Server Components. Lit les cookies via
`next/headers`. Écritures de cookies entourées d'un `try/catch` silencieux : un
Server Component n'a pas le droit d'écrire un cookie, et le middleware s'en
charge de toute façon.

**`lib/supabase/client.ts`** — pour les Client Components.

**Connexion :** `supabase.auth.signInWithPassword`, puis `router.push("/")` **et**
`router.refresh()` — ce dernier est indispensable pour rejouer les Server
Components avec la nouvelle session.

**Déconnexion :** `supabase.auth.signOut()` + `router.refresh()`, bouton en pied
de barre latérale. *(Absent de la version précédente.)*

---

## 5. Modèle de données

PostgreSQL / Supabase. Extension `pgcrypto` requise (`gen_random_uuid()`).

### 5.1 Relations

```
auth.users
    └─1:1─ profiles ──────────┐
                              │ (employe_id)
clients                       │
    ├─1:N─ vehicules          │
    ├─0:N─ rendez_vous ◄──────┤
    ├─0:N─ bons_travail ◄─────┘
    └─0:N─ factures                    (V2)

vehicules
    ├─0:N─ rendez_vous
    ├─0:N─ bons_travail
    └─0:N─ factures                    (V2)

rendez_vous
    └─0:1─ bons_travail       (un RDV peut donner un bon de travail)

bons_travail
    ├─1:N─ bon_travail_lignes
    └─0:1─ factures                    (V2)

bon_travail_lignes
    └─0:1─ inventaire         (une ligne « pièce » peut pointer une référence)

parametres                    (ligne unique, id = 1)
```

### 5.2 Tables reprises, avec corrections

#### `profiles` — employés

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` `on delete cascade` |
| `nom` | `text` | `not null` |
| `role` | `text` | `not null`, défaut `'mecanicien'`, **`check in ('admin','reception','mecanicien')`** |
| `actif` | `boolean` | `not null`, défaut `true` — *nouveau* |
| `created_at` | `timestamptz` | `not null`, défaut `now()` |

Créée automatiquement par le trigger `on_auth_user_created` (fonction
`handle_new_user()`, `security definer`), avec `nom` repris de
`raw_user_meta_data->>'nom'`, sinon le courriel.

> **Changement de RLS.** La version précédente limitait la lecture à sa propre
> ligne. L'assignation des rendez-vous et des bons de travail à un mécanicien
> impose de **pouvoir lire la liste des collègues**. Nouvelle politique : lecture
> ouverte à tout compte authentifié, écriture limitée à sa propre ligne.

#### `clients`

`id` uuid PK · `nom` text not null · `telephone` text · `adresse` text ·
`email` text · `notes` text *(nouveau)* · `created_at` · `updated_at`

Index : `idx_clients_nom` sur `lower(nom)` — la recherche passe côté serveur
via `.ilike()`, plus de filtrage en JavaScript.

#### `vehicules`

`id` uuid PK · `client_id` uuid not null FK → `clients` `on delete cascade` ·
`marque` text not null · `modele` text · `annee` int · `plaque` text ·
`vin` text · `couleur` text *(nouveau)* · `created_at` · `updated_at`

Index : `idx_vehicules_client` sur `(client_id)`.
**Nouveaux index uniques partiels** — évitent les fiches en double sans
interdire les champs vides :

```sql
create unique index idx_vehicules_plaque_uniq
  on vehicules (upper(plaque)) where plaque is not null and plaque <> '';
create unique index idx_vehicules_vin_uniq
  on vehicules (upper(vin)) where vin is not null and vin <> '';
```

#### `rendez_vous`

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` | PK |
| `client_id` | `uuid` | FK → `clients` `on delete set null` |
| `vehicule_id` | `uuid` | FK → `vehicules` `on delete set null` |
| **`employe_id`** | `uuid` | FK → `profiles(id)` `on delete set null` — *nouveau* |
| `date` | `date` | `not null` |
| `heure` | `time` | `not null` |
| **`duree_min`** | `int` | `not null`, défaut `60` — *nouveau* |
| `description` | `text` | `not null` |
| `statut` | `text` | `not null`, défaut `'prevu'`, **`check in ('prevu','confirme','en_cours','termine','annule','absent')`** |
| `created_at`, `updated_at` | `timestamptz` | |

Index : `idx_rdv_date` sur `(date)`, `idx_rdv_employe` sur `(employe_id, date)`.

#### `inventaire` — pièces

`id` uuid PK · **`reference` text** *(nouveau)* · `nom` text not null ·
`quantite` int not null défaut 0 · `seuil` int not null défaut 3 ·
**`prix_achat` numeric(10,2) not null défaut 0** *(nouveau)* ·
`prix` numeric(10,2) not null défaut 0 *(prix de vente)* ·
**`fournisseur` text** *(nouveau, champ libre — table dédiée en V4)* ·
`created_at` · `updated_at`

Stock bas : `quantite <= seuil`. **Calculé en SQL**, plus en JavaScript après
chargement complet de la table.

#### `parametres` — ligne unique, `check (id = 1)`

| Colonne | Type | Défaut |
|---|---|---|
| `id` | `int` | PK, `1` |
| `nom` | `text` | `'MECAFORCE'` |
| `adresse`, `telephone`, `courriel` | `text` | |
| `tps`, `tvq` | `text` | numéros d'inscription (`'713585354RT0001'`, `'1231905380TQ0001'`) |
| **`taux_tps`** | `numeric(6,5)` | `0.05000` — *nouveau* |
| **`taux_tvq`** | `numeric(6,5)` | `0.09975` — *nouveau* |
| **`taux_horaire`** | `numeric(10,2)` | `0` — *nouveau* |
| **`validite_evaluation_jours`** | `int` | `30` — *nouveau* |
| **`garantie_mois`** | `int` | `3` — *nouveau* |
| **`garantie_km`** | `int` | `5000` — *nouveau* |

Les taux sortent de la vue SQL et entrent en paramètres : ils doivent pouvoir
être copiés sur un document au moment de son émission (D13).

### 5.3 Tables nouvelles

#### `bons_travail`

Le document central de la V1.

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` | PK |
| `numero` | `text` | `not null unique`, défaut `'BT-' \|\| lpad(nextval('bon_travail_numero_seq')::text, 4, '0')` |
| `client_id` | `uuid` | FK → `clients` `on delete set null` |
| `vehicule_id` | `uuid` | FK → `vehicules` `on delete set null` |
| `rendez_vous_id` | `uuid` | FK → `rendez_vous` `on delete set null` |
| `employe_id` | `uuid` | FK → `profiles` `on delete set null` |
| `kilometrage` | `int` | `not null` — obligatoire pour la facture (§4.2 du PRD) |
| `plainte_client` | `text` | `not null` — dans les mots du client |
| `diagnostic` | `text` | |
| `notes_internes` | `text` | non imprimé |
| `statut` | `text` | `not null`, défaut `'evaluation'`, `check in ('evaluation','autorise','en_cours','termine','facture','annule')` |
| `taux_horaire` | `numeric(10,2)` | `not null` — **copié depuis `parametres` à la création** (D13) |
| `montant_evaluation` | `numeric(10,2)` | figé à l'acceptation |
| `evaluation_acceptee_le` | `timestamptz` | |
| `evaluation_valide_jusqu_au` | `date` | |
| `renonciation_ecrite` | `boolean` | `not null`, défaut `false` — le client a remis une renonciation manuscrite |
| `pieces_a_remettre` | `boolean` | `not null`, défaut `false` |
| `ouvert_le` | `date` | `not null`, défaut `current_date` |
| `ferme_le` | `date` | |
| `created_at`, `updated_at` | `timestamptz` | |

Index : `(statut)`, `(vehicule_id, ouvert_le desc)`, `(employe_id, statut)`.

**Règle métier :** `montant_evaluation` et `taux_horaire` ne sont jamais
recalculés. Une fois `evaluation_acceptee_le` renseigné, le montant est
juridiquement engageant.

#### `bon_travail_lignes`

| Colonne | Type | Contraintes |
|---|---|---|
| `id` | `uuid` | PK |
| `bon_travail_id` | `uuid` | `not null`, FK → `bons_travail` `on delete cascade` |
| `type` | `text` | `not null`, `check in ('piece','main_oeuvre')` |
| `description` | `text` | `not null` |
| `quantite` | `numeric(10,2)` | `not null`, défaut `1` — unités pour une pièce, **heures** pour la main-d'œuvre |
| `prix_unitaire` | `numeric(10,2)` | `not null`, défaut `0` — prix pièce, ou **taux horaire** |
| `piece_id` | `uuid` | FK → `inventaire(id)` `on delete set null` — optionnel |
| `etat_piece` | `text` | `check in ('neuve','usagee','reusinee','remise_a_neuf')` — **obligatoire si `type = 'piece'`** |
| `ordre` | `int` | `not null`, défaut `0` |

```sql
constraint etat_piece_requis check (
  (type = 'piece' and etat_piece is not null)
  or (type = 'main_oeuvre' and etat_piece is null)
)
```

Index : `idx_bt_lignes_bon` sur `(bon_travail_id, ordre)`.

> **Cette table est le futur `facture_lignes`.** En V2, générer une facture
> consistera à copier ces lignes en figeant les montants. Aucune migration.

### 5.4 Vue `bons_travail_totaux`

| Colonne | Calcul |
|---|---|
| `total_pieces` | `sum(quantite × prix_unitaire) where type = 'piece'` |
| `total_main_oeuvre` | `sum(quantite × prix_unitaire) where type = 'main_oeuvre'` |
| `total_ht` | `total_pieces + total_main_oeuvre` |
| `depasse_evaluation` | `montant_evaluation is not null and total_ht > montant_evaluation` |

`left join` + `coalesce(..., 0)` pour qu'un bon sans ligne apparaisse à zéro.
Créée avec **`security_invoker = true`** — corrige le fait qu'une vue Postgres
n'hérite pas de la RLS de ses tables.

### 5.5 Taxes — la correction

Rappel du bug de la version précédente : chaque colonne était arrondie
indépendamment, donc `total_ht + tps + tvq` pouvait différer de `total_ttc` d'un
cent sur un document remis au client.

**Règle retenue :**

```
tps       = round(total_ht × taux_tps,  2)
tvq       = round(total_ht × taux_tvq,  2)
total_ttc = total_ht + tps + tvq          ← somme des valeurs DÉJÀ arrondies
```

Les taux applicables (TPS 5 %, TVQ 9,975 %, toutes deux sur le montant avant
taxes — régime québécois depuis 2013) viennent de `parametres`, et sont **copiés
sur le document** à l'émission de la facture en V2. Un changement de taux ne
touchera jamais un document passé.

### 5.6 RLS

| Table | Politique |
|---|---|
| `clients`, `vehicules` | `select` pour tout authentifié · `insert` / `update` pour `admin` et `reception` · `delete` pour `admin` |
| `rendez_vous` | `select` pour tout authentifié · `insert` / `update` pour `admin` et `reception` · `delete` pour `admin` |
| `bons_travail` | `select` pour tout authentifié · `insert` pour `admin` et `reception` · `update` pour `admin`, `reception`, **et le mécanicien assigné** (`employe_id = auth.uid()`) · `delete` pour `admin` |
| `bon_travail_lignes` | `select` pour tout authentifié · écriture pour `admin`, `reception`, et le mécanicien assigné au bon parent |
| `inventaire` | `select` pour tout authentifié · écriture pour `admin` et `reception` |
| `factures`, `facture_lignes` | *(V2)* `select` pour tout authentifié · écriture pour `admin` et `reception` |
| `parametres` | `select` pour tout authentifié · `update` réservé au rôle `admin` |
| `profiles` | **`select` pour tout authentifié** *(changé)* · `update` limité à `auth.uid() = id` **ou à un admin sur n'importe quel profil** (D27) — et un trigger empêche de changer son propre `role` sauf pour un admin (D24) · pas d'`insert` ni de `delete` — trigger et cascade s'en chargent |

> **Fonction d'aide.** Une fonction `est_role(variadic text[])` en
> `security definer` lit `profiles.role` pour l'utilisateur courant. Toutes les
> politiques ci-dessus s'écrivent avec elle plutôt qu'avec une sous-requête
> répétée sur `profiles` — qui provoquerait une **récursion RLS**.
>
> **Les colonnes d'évaluation ne se protègent pas par RLS.** PostgreSQL applique
> la RLS à la ligne, pas à la colonne : une politique `update` ne peut pas
> interdire au mécanicien de toucher `montant_evaluation` tout en l'autorisant
> sur `diagnostic`. L'acceptation d'une évaluation passe donc par des fonctions
> `security definer` dédiées (`accepter_evaluation(bon_id)`,
> `renoncer_evaluation(bon_id)`), qui vérifient `est_role('admin','reception')`.
>
> **Ça ne suffit pas tout seul (D25).** Rien n'empêchait par ailleurs un appel
> direct à `update bons_travail set statut = 'autorise', ...` de contourner ces
> deux fonctions — la policy `update` du mécanicien assigné ne distingue pas
> la colonne touchée. Un trigger `proteger_autorisation_bon_trigger` bloque
> maintenant tout changement de `statut` vers `autorise`, ou de
> `montant_evaluation`/`evaluation_acceptee_le`, pour qui n'est pas
> admin/reception — qu'il passe par les fonctions ci-dessus ou une écriture
> directe. C'est le vrai garde-fou ; le `grant` sur les fonctions est une
> commodité d'API, pas la protection.
>
> Ce tableau resserre le modèle « outil interne » de D4 : tout compte
> authentifié reste du personnel, mais les actes engageants — paramètres,
> suppression, acceptation d'évaluation — sont réservés.

### 5.7 `updated_at`

Une fonction `set_updated_at()` et un trigger `before update` sur chaque table
métier. Aucune table n'en avait.

---

## 6. Les deux modèles de page

| Modèle | Fichier de référence | Pour quoi |
|---|---|---|
| **Server Component** | `app/page.tsx` | Pages en lecture seule. `export const dynamic = "force-dynamic"`, requêtes en parallèle via `Promise.all` |
| **Client Component** | `app/clients/page.tsx` | Pages CRUD. `"use client"`, chargement en `useEffect`, état local, rechargement après écriture |

**Règles pour toute nouvelle page CRUD :**

1. Formulaire réel dans une modale ou un panneau latéral. Jamais de `prompt()`.
2. Toute erreur Supabase est **affichée à l'écran**, jamais avalée.
3. Recherche côté serveur (`.ilike()`), pas de filtrage sur un tableau complet.
4. État de chargement visible, et état vide explicite (« aucun client »).
5. Confirmation avant suppression, dans une modale — jamais `confirm()`.

---

## 7. Charte visuelle

Reprise de l'existant, à respecter partout :

- Fond d'application `stone-100` ; cartes blanches, bordure `stone-200`, `rounded-lg`
- Barre latérale `slate-900` ; élément actif `amber-400`, liseré droit `amber-500`
- Accent et boutons d'action : `amber-700`, survol `amber-800` *(corrigé au Lot 9 —
  voir D28 : `amber-500` sous texte blanc ne tenait pas la contrainte de contraste
  AA que la ligne ci-dessous exige depuis le premier jour)*
- Titres de page : `text-xl font-black uppercase tracking-wide`
- Sémantique : **rouge** = impayé, stock bas, dépassement d'évaluation ·
  **émeraude** = sain, terminé · **ambre** = action · **ardoise** = neutre

**Contraintes tablette (D17) :**

- Cible tactile minimale 44 × 44 px
- Aucune information accessible uniquement au survol
- Écran bon de travail lisible à 60 cm : corps ≥ 16 px, contraste AA
- Les tableaux denses passent en cartes empilées sous 768 px

---

## 8. Dates et fuseau horaire

Le bug de la version précédente : `new Date().toISOString().slice(0,10)` donne
une date **UTC**. À Montréal, à partir de 20 h l'été, le tableau de bord affichait
les rendez-vous du lendemain.

**Règle (D18) :** toute date métier passe par `lib/dates.ts`, qui travaille en
`America/Toronto`. `rendez_vous.date` et `heure` restent des types `date` / `time`
sans fuseau — ce sont des heures d'atelier locales, pas des instants.

---

## 9. Installation

```bash
git clone <dépôt>
cd mecaforce
npm install
cp .env.local.example .env.local   # remplir les 2 variables
npm run dev
```

Variables : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(*Project Settings → API*). La clé `anon` est **publique par conception** —
c'est la RLS qui protège les données. **Ne jamais** mettre la clé `service_role`
dans une variable préfixée `NEXT_PUBLIC_`.

Base : coller `supabase/schema.sql` dans *SQL Editor*. Premier compte via
*Authentication → Users → Add user*, avec une clé `nom` dans les métadonnées.

Types : `npm run types` → `supabase gen types typescript --project-id <id> > lib/database.types.ts`

---

## 10. Journal de décisions

Le tableau qui manquait le plus. Une ligne par décision, ajoutée au fil de l'eau.

| Date | Décision | Raison | Alternative écartée |
|---|---|---|---|
| 2026-08-11 | Supabase + RLS sans backend | Moins de code à maintenir | API Next.js + Prisma |
| 2026-08-11 | Totaux de facture par vue SQL | Pas de dérive lignes / total | Colonnes calculées stockées |
| 2026-08-12 | **Reconstruction à neuf** plutôt que reprise | Aucun code ne subsistait ; les décisions, si | Réécrire le code depuis les docs sans rien changer |
| 2026-08-12 | **Git dès le premier commit** | Cause racine de la perte du code précédent | Continuer sans dépôt |
| 2026-08-12 | **V1 = atelier, V2 = facturation** | Le besoin quotidien est le bon de travail, Excel tient encore pour facturer | Tout livrer d'un coup |
| 2026-08-12 | **Lignes typées pièce / main-d'œuvre** | Exigence légale de la facture québécoise | Lignes génériques |
| 2026-08-12 | **Montant d'évaluation et taux figés** | L'évaluation acceptée lie le garage, sans marge de dépassement | Recalcul permanent |
| 2026-08-12 | **`etat_piece` obligatoire** | Mention obligatoire sur évaluation et facture | Champ libre optionnel |
| 2026-08-12 | **Kilométrage obligatoire au bon de travail** | Mention obligatoire sur facture + base des rappels et de la garantie | Champ optionnel |
| 2026-08-12 | **`profiles` en lecture ouverte** | Nécessaire à l'assignation des RDV et bons | Garder la lecture limitée à sa ligne |
| 2026-08-12 | **Trois rôles : `admin`, `reception`, `mecanicien`** | Ferme Q4 et Q5 du PRD. Le comptoir et l'atelier ne posent pas les mêmes actes | Deux rôles (`admin` / `employe`) |
| 2026-08-12 | **Acceptation d'évaluation par fonction `security definer`** | La RLS est au niveau ligne ; il fallait un verrou au niveau colonne (D13, D23) | Laisser le mécanicien accepter depuis la tablette |
| 2026-08-12 | **D24 — Trigger bloquant l'auto-promotion sur `profiles`** | Trouvé en vérifiant le Lot 1 (1.10) : `profiles_update_self` autorisait n'importe quel compte à changer son propre `role`, pas seulement son `nom` | Compter sur la seule policy `auth.uid() = id`, sans garde sur la colonne |
| 2026-08-12 | **D25 — Trigger bloquant l'auto-autorisation sur `bons_travail`** | Trouvé en construisant le Lot 5 : même faille que D24, mais sur `statut`/`montant_evaluation`/`evaluation_acceptee_le` — un mécanicien assigné pouvait les écrire directement sans passer par `accepter_evaluation()` | Compter sur le seul `grant` des fonctions `security definer`, sans garde au niveau table |
| 2026-08-12 | **D26 — `ouvert_le` toujours fourni par l'app, jamais par le défaut `current_date`** | Trouvé en testant le Lot 7 : `current_date` tourne dans le fuseau du serveur Postgres (UTC chez Supabase), pas `America/Toronto` — même piège que D18, déplacé à la base de données. `bons_travail/nouveau` passe maintenant `todayLocal()` explicitement | Garder le défaut de colonne et espérer que personne ne crée un bon entre 20 h et minuit HAE |
| 2026-08-13 | **D27 — Policy permettant à l'admin de gérer n'importe quel profil** | Trouvé en préparant le Lot 8 : `profiles_update_self` limitait toute écriture à `auth.uid() = id`, donc même un admin ne pouvait pas changer le rôle ou désactiver le compte d'un employé. L'écran d'assignation des rôles (8.5) l'exige | Découvrir le trou seulement une fois l'écran construit, sans pouvoir le tester |
| 2026-08-13 | **Stock bas calculé en colonne générée (`stock_bas`)** | Éviter de charger toute la table en JavaScript pour filtrer côté client (défaut de la version précédente, PLAN 8.2) | Vue séparée ou filtre `.lte()` sur une valeur fixe (PostgREST ne compare pas deux colonnes) |
| 2026-08-13 | **D28 — `amber-500` remplacé par `amber-700` sur tout texte/bouton/anneau de focus** | Trouvé en calculant les contrastes réels pour la passe d'accessibilité du Lot 9 : `amber-500` sous texte blanc ne fait que 2.15:1 (il faut 4.5), l'anneau de focus au même ton ne fait que 2.15:1 (il faut 3:1). `amber-700` : 5.02:1. Contredit `amber-500, survol amber-600` de §7, gardé comme accent décoratif (bordures, points de statut) où la règle ne s'applique pas | Garder `amber-500` partout et espérer que ça passe une vraie vérification |
| 2026-08-13 | **D29 — `stone-400` remplacé par `stone-500` sur tout texte** | Même passe : `stone-400` sur blanc ne fait que 2.52:1, utilisé partout comme couleur d'étiquette de champ et de texte secondaire. `stone-500` : 4.80:1 | Garder `stone-400`, le gris le plus utilisé du projet après le blanc et le noir |
| 2026-08-13 | **Menu déroulant marque/modèle sur le formulaire véhicule** | Champ texte libre depuis le début, sans suggestion. Table `ref_vehicule_ymm` + vue `ref_marques` moissonnées depuis l'API vPIC (garage-data/), avec repli en saisie libre (« Autre ») pour les véhicules absents | Un `<input list>` (datalist) : pas de suggestions sur Safari iOS, casserait D17 sur mobile |
| 2026-08-13 | **D30 — Borne d'enregistrement client (`/accueil`) : table d'attente, jamais d'écriture directe** | Premier accès public (sans connexion) de l'application, déclenché par QR code ou tablette au comptoir. Le formulaire client écrit uniquement dans `demandes_accueil` (policy d'insertion ouverte à `anon`) ; la réception valide une par une sur `/demandes-accueil`, qui seul crée le vrai client + véhicule. Même principe que `accepter_evaluation()` (D13) : rien d'officiel sans un humain qui confirme | Écriture directe dans `clients`/`vehicules` depuis la page publique — un lien trouvé ou repartagé aurait pu polluer les vraies données |
| 2026-08-13 | **`ref_vehicule_ymm` en lecture publique (`anon`)** | Trouvé en testant D30 : la policy de lecture d'origine exigeait `authenticated`, donc le menu marque/modèle restait vide sur la page publique sans connexion. Ce sont des données de catalogue non confidentielles (vPIC + correctifs canadiens) — aucun risque à les ouvrir à `anon` | Dupliquer les données dans une table publique séparée |
| 2026-08-13 | **Démarrage de la V2 — facturation** | `factures`/`facture_lignes` précisées par migration (posées provisoirement au Lot 1, D21) : montants, taxes et garantie figés à l'émission (`creer_facture()`, même logique que `accepter_evaluation()`, D13), paiements partiels (`montant_paye`), statut dérivé automatiquement par trigger. Bon de travail « terminé » → bouton « Créer la facture » → statut `facture` | Continuer à facturer sur Excel indéfiniment |
| 2026-08-13 | **D31 — Trigger bloquant la modification des montants d'une facture émise** | Même faille de classe que D24/D25 : la policy `factures_write_admin_reception` autorise l'écriture de toute la ligne, y compris `total_ttc`/taxes/kilométrage après coup, alors que ce sont des montants légalement figés. Le trigger n'autorise plus que `montant_paye` (et le `statut` qui en dérive) à changer une fois la facture créée | Compter sur la seule discipline de ne pas modifier ces champs depuis l'interface |
| 2026-08-14 | **D32 — Annulation de facture (avoir) au lieu de la déverrouiller** | Conséquence directe de D31 : une fois les montants figés, aucune façon de corriger une erreur de facturation. `annuler_facture()` (admin seulement, motif obligatoire) marque la facture `annulee` — jamais d'édition des montants — et redonne au bon de travail son statut `terminé` pour permettre une facture corrigée. Index unique sur `bon_travail_id` ajusté pour ignorer les factures annulées, sinon impossible de refacturer le même bon | Autoriser l'admin à éditer directement les montants d'une facture émise — casserait tout l'intérêt de D31 |
| 2026-08-14 | **D33 — Décrément de stock au passage `en_cours` → `terminé`, pas à l'ajout de la ligne** | Hors périmètre V1 (PRD §5.4), demandé ensuite. Décrémenter dès l'ajout d'une ligne ferait baisser l'inventaire pour un simple devis jamais accepté. Un seul trigger groupé, agrégé par pièce (`sum(quantite)`), déclenché précisément sur `old.statut = 'en_cours'` — jamais sur un retour `facture → terminé` via `annuler_facture()`, qui décrémenterait une deuxième fois les mêmes pièces | Décrémenter à l'ajout de chaque ligne pièce, quel que soit le statut du bon |
| 2026-08-14 | **Lignes de pièce reliées à l'inventaire (`piece_id`)** | Trouvé en testant D33 : le formulaire de ligne ne renseignait jamais `piece_id`, donc le décrément ne se déclenchait jamais en pratique. Menu "Pièce en inventaire" optionnel, qui pré-remplit description/prix ; "hors inventaire" garde la saisie libre d'origine | — |
| 2026-08-14 | **Statut `attente_piece` sur les bons de travail** | S'insère entre `en_cours` et `terminé` — un seul aller-retour (`en_cours ⇄ attente_piece`), jamais de raccourci direct vers `terminé` depuis l'attente, pour garder un seul chemin de sortie clair. Compte comme "à l'atelier" au tableau de bord | Un champ libre "raison de l'attente" séparé — les notes internes existantes suffisent |
| 2026-08-14 | **Transfert de propriétaire d'un véhicule** | `bons_travail.client_id` était déjà figé à la création (jamais dérivé du véhicule) — l'historique reste donc automatiquement attribué au bon propriétaire de l'époque. Aucune migration nécessaire : juste une modale de transfert qui met à jour `vehicules.client_id`, RLS déjà en place (`vehicules_update_admin_reception`) | Une table d'historique de propriété séparée — pas demandé, le service history suffisait déjà |
| 2026-08-14 | **Refonte visuelle — Phase 2 : composants de base** | Les 11 composants `ui/` réthémisés sur les tokens `mf-*` (BRAND.md), plus 6 nouveaux : `BrandStripes`, `Skeleton`, `Tooltip`, `Tabs`, `Pagination`, `ToastProvider`/`useToast` (posé dans `layout.tsx`, pas encore appelé nulle part). `grep` hex/rgb hors `globals.css` revient vide — un seul token `--mf-overlay` créé pour l'unique cas qui l'exigeait (superposition de modale), plutôt qu'un rgba() recopié en dur | Laisser le rgba() de la superposition en dur dans `Modale.tsx` — aurait cassé la règle « aucune couleur hors tokens » du brief |
| 2026-08-14 | **Refonte visuelle — Phase 3 : coquille de l'application** | `Sidebar` (barre du haut mobile, tiroir, barre latérale fixe), `LogoutButton`, `app/login`, et `<body>` de `app/layout.tsx` réthémisés sur `mf-*`. Nouveau `ThemeToggle` (lit `data-theme`, écrit `localStorage['mf-theme']` + l'attribut au clic) intégré au tiroir mobile et à la barre latérale, à côté de `LogoutButton` — vérifié dans les deux thèmes et à 375/1280px. Écran de connexion : `BrandStripes` en filigrane à 6 % d'opacité (BRAND.md §5), aucune autre nouveauté visuelle. Filtrage des routes (`adminSeulement`/`receptionSeulement`, `usePathname`) intact, seule la couche présentation a changé | Ajouter l'interrupteur ailleurs qu'à côté de la déconnexion — BRAND.md ne précisait pas d'emplacement, celui-ci était le plus proche des actions de compte existantes |
| 2026-08-14 | **D34 — Bug utilisateur : texte invisible en mode sombre sur les pages non retethémées** | Signalé par l'utilisateur juste après la Phase 3 (« dans le mode sombre on ne voit pas le texte rendez-vous, véhicule à l'atelier, bon en attente... ») : `<body>` porte désormais `text-mf-text` (clair) par défaut, mais toutes les pages de contenu (tableau de bord, clients, bons de travail, factures, rendez-vous, inventaire, paramètres, bornes) utilisaient encore des cartes `bg-white` codées en dur avec du texte sans couleur explicite — invisible, texte clair hérité sur fond blanc. A déclenché l'exécution complète de la Phase 4 (toutes les pages) au lieu d'un correctif isolé, le même bug touchant chaque écran | Corriger seulement le tableau de bord signalé et laisser les autres écrans casser un par un |
| 2026-08-16 | **D35 — Sauvegarde Supabase : trois bugs distincts empilés, trouvés un par un en testant** | `sauvegarde-supabase.yml` échouait depuis des semaines (9.5, mis en pause). Remis en route en le testant vraiment plutôt qu'en le relisant : (1) l'utilisateur du pooler Supabase doit être `postgres.<ref-projet>`, pas `postgres` seul — le pooler route par suffixe d'utilisateur ; (2) la « Direct connection » Supabase (`db.<ref>.supabase.co`) est IPv6 uniquement depuis 2024, confirmé en observant qu'elle n'a qu'un enregistrement AAAA, aucun A — injoignable depuis les runners GitHub Actions, peu importe la justesse du secret (a fait perdre plusieurs essais avant d'être identifié, le message d'erreur `Name or service not known` semblant d'abord pointer vers une erreur de copier-coller) ; (3) `postgresql-client` d'Ubuntu installe `pg_dump` 16 par défaut, qui refuse de sauvegarder le serveur Supabase en PostgreSQL 17 — dépôt PGDG officiel nécessaire pour `postgresql-client-17`. Host/utilisateur du pooler mis en dur dans le workflow (non sensibles), seul le mot de passe reste secret — réduit la surface d'erreur de copier-coller pour la prochaine fois | Continuer à deviner depuis les seuls messages d'erreur sans vérifier chaque hypothèse (résolution DNS testée en local avant de conclure) |
| 2026-08-14 | **Refonte visuelle — Phase 4 : toutes les pages** | Les 16 écrans réthémisés sur `mf-*`, dans l'ordre du plan (tableau de bord → bons de travail → clients/véhicules → factures → rendez-vous/inventaire/paramètres → bornes `/accueil` et `/demandes-accueil`). Les deux documents légaux imprimables (`bons-travail/[id]/evaluation`, `factures/[id]`) restent volontairement papier blanc/texte noir en permanence — décision délibérée, pas un oubli — mais avaient le même bug D34 : texte sans couleur explicite sur fond blanc. Couleur de texte rendue explicite (`text-stone-900` sur le conteneur) plutôt que de basculer ces pages sur les tokens sombres, pour que l'écran corresponde toujours exactement à l'impression. La borne publique `/accueil` (premier contact client) reprend le traitement de l'écran de connexion (`BrandStripes` en filigrane) plutôt qu'un simple nettoyage de couleurs — c'est l'écran qui donne la première impression au client, la même logique que la demande initiale de refonte | Garder les documents légaux sur les tokens sombres par cohérence de thème — aurait rendu le PDF exporté différent de ce que montre l'écran, un risque sur un document engageant |
| 2026-08-16 | **D36 — Catalogue générique de pièces (`ref_pieces`) pour le menu déroulant de nom de pièce** | Demandé pour éviter la saisie libre du nom lors de la création d'un item d'inventaire et de l'ajout d'une ligne « pièce » hors inventaire sur un bon de travail. Contrairement à `ref_vehicule_ymm` (moissonné depuis l'API vPIC), il n'existe pas d'équivalent gratuit pour un catalogue de pièces — liste de 117 pièces sur 13 catégories écrite à la main pour un atelier généraliste. Même patron exact que marque/modèle : `Selecteur` catégorie → `Selecteur` pièce (rempli via `usePieces(categorie)`), repli « Autre (préciser)… » en saisie libre. La ligne inventaire-liée d'un bon de travail (`piece_id` → `inventaire`, décrément de stock D33) n'est pas touchée — le catalogue ne s'applique qu'au cas « pièce hors inventaire », qui n'avait jusqu'ici qu'un champ texte libre | Fusionner ce nouveau catalogue avec la table `inventaire` elle-même — aurait mélangé un référentiel générique (partagé, en lecture seule) avec le stock réel du garage (par établissement, modifiable) |
| 2026-08-16 | **`code_barre` et `installee_le` sur `bon_travail_lignes`** | Demandé pour tracer précisément quelle pièce a été posée sur quel véhicule et quand, en cas de retour client en garantie — au niveau de la ligne (une pièce précise), pas seulement du bon (`ferme_le` existant, trop grossier si plusieurs pièces posées à des dates différentes sur un même bon resté ouvert). Champ code-barres en texte libre : un lecteur de code-barres USB standard émet les mêmes frappes clavier qu'une saisie manuelle, aucune intégration matérielle nécessaire. Date d'installation pré-remplie à `todayLocal()`, modifiable | Se fier uniquement à `bons_travail.ferme_le` pour la garantie — ne distingue pas la date réelle de pose de chaque pièce si le bon reste ouvert plusieurs jours |
| 2026-08-16 | **Menu déroulant année sur le formulaire véhicule, chaîné après marque/modèle** | Le champ `annee` était un simple input numérique, sans validation ni suggestion, alors que marque/modèle avaient déjà le menu déroulant `ref_vehicule_ymm` (D du 2026-08-13). `ref_vehicule_ymm` a une contrainte unique `(marque, modele, annee)` — les années ne sont pas une liste indépendante, elles sont propres à un couple marque/modèle précis (`useAnnees(marque, modele)`, troisième niveau de la même chaîne). Même repli « Autre (préciser)… » que marque/modèle ; le menu se vide et se désactive tant qu'aucun modèle n'est choisi, et change de marque ou de modèle réinitialise l'année sélectionnée. Appliqué aux deux endroits qui saisissent un véhicule : `FormulaireVehicule.tsx` et la copie indépendante du même formulaire sur la borne publique `/accueil` (D30) | Une liste d'années générique (ex. 1980–année courante) indépendante de la marque/modèle — aurait proposé des années où le modèle choisi n'existait pas |
| 2026-08-16 | **Inventaire de véhicules à vendre (`vehicules_stock`)** | Demandé pour suivre les véhicules que le garage possède et revend, en plus des réparations. Volontairement une table séparée de `vehicules` (toujours lié à un client qui l'apporte pour réparation) plutôt qu'un champ « appartient au garage » dessus — les deux notions ne partagent presque rien (pas de client, pas de bon de travail). Suivi simple demandé explicitement : pas de facture générée à la vente (contrairement aux réparations, D13/D21), juste `statut` (disponible/réservé/vendu), coût d'achat, prix demandé, et à la vente : prix réel, acheteur, date — marge calculée à l'affichage, jamais stockée (même principe D7). Une seule page liste (`/vehicules-stock`), même patron que `/inventaire` (pièces) : select+modales, pas de page de détail séparée. Menus marque/modèle/année réutilisés tels quels (mêmes hooks que `FormulaireVehicule.tsx`). RLS identique à `inventaire` : lecture pour tout le personnel, écriture admin/reception | Ajouter un champ booléen « en vente » sur `vehicules` — aurait mélangé un actif du garage (prix, marge, acheteur) avec le dossier d'un véhicule client (historique de service, garantie) |
| 2026-08-17 | **Photos sur les véhicules en stock** | Demandé pour avoir un vrai listing visuel sur `/vehicules-stock`. Colonne `photos text[]` (chemins de stockage, pas les URLs complètes — reconstruites à l'affichage via `getPublicUrl()`, plus robuste si le bucket change) plus un bucket Supabase Storage dédié `vehicules-stock`, public en lecture (photos de véhicules, aucune donnée sensible), écriture réservée admin/reception comme la table elle-même. Téléversement multiple depuis le formulaire (chemin = `uuid-nomfichier`, pas de dossier par véhicule — fonctionne aussi bien à la création, avant que la ligne existe, qu'en édition). Miniature cliquable dans la liste ouvrant une galerie ; les fichiers du bucket sont supprimés avec le véhicule pour éviter les orphelins | Un dossier de stockage nommé par l'id du véhicule — impossible à la création (l'id n'existe qu'après l'insert), aurait forcé un flux en deux temps (créer puis téléverser) |
| 2026-08-16 | **D37 — Réévaluation complémentaire d'un bon de travail** | Le bandeau `depasseEvaluation` existant (dépassement du montant évalué) n'était qu'informatif : rien n'empêchait de continuer ou de facturer au-delà sans réautorisation du client, et aucune trace n'existait de qui avait accepté quel montant. Nouvelle table `bon_travail_evaluations` (journal, écriture uniquement via fonctions `security definer`, aucune policy insert/update/delete) et fonction `reevaluer_bon()` — même geste qu'`accepter_evaluation()` (D13) mais qui ne touche jamais au `statut` du bon (déjà `autorise`/`en_cours`/`attente_piece`), seulement au montant accepté. `accepter_evaluation()` journalise désormais aussi l'acceptation initiale, pour un historique complet dès le premier montant. Affiché sur le bon (bouton dans le bandeau, historique dans la carte des totaux) et sur l'évaluation imprimable (bloc d'amendement, uniquement si plus d'une acceptation) | Réutiliser `accepter_evaluation()` telle quelle pour la réévaluation — elle repasse le statut à `autorise`, ce qui ferait reculer un bon déjà en cours de réparation |
| 2026-08-17 | **Notification en temps réel des nouvelles arrivées** | Version « simple » retenue plutôt que du push (fonctionne seulement app ouverte dans un onglet, mais c'est le cas normal pour la réception au comptoir — D30). `demandes_accueil` ajoutée à la publication `supabase_realtime` (aucune table n'y était jusqu'ici) ; premier appel réel de `ToastProvider`/`useToast`, posés en Phase 2 mais jamais utilisés depuis. Badge sur "Nouvelles arrivées" = compte des demandes `statut = 'nouvelle'`, tenu à jour par les événements INSERT/UPDATE plutôt que par un simple compteur de toasts vus — reste juste si un autre poste traite une demande, ou après un rechargement de page | Un compteur "non lus" basé sur la session (vu/pas vu) plutôt que sur le statut réel — se désynchroniserait dès qu'un deuxième poste ou un rechargement de page entre en jeu |
| 2026-08-17 | **Envoi de facture par courriel (Gmail SMTP)** | Bouton « Envoyer par courriel » sur la facture imprimable, plutôt qu'automatique à la création — laisse une chance de vérifier avant que ça parte chez le client. Premier `app/api/` du projet (Route Handler côté serveur, `nodemailer` + SMTP Gmail via un mot de passe d'application dédié, jamais le vrai mot de passe du compte). HTML d'e-mail en tableaux avec styles en ligne, pas les classes Tailwind de la page imprimable — la plupart des clients de messagerie ignorent les feuilles de style externes/classes. `factures.envoyee_le`/`envoyee_a` tracent le dernier envoi ; volontairement hors du trigger de protection D31, cette information doit pouvoir changer après l'émission (même logique que `montant_paye`) | Envoi automatique dès `creer_facture()` — plus proche de la demande initiale, mais aucune chance de rattraper une adresse erronée ou une facture à corriger avant qu'elle parte |
| 2026-08-18 | **Renommer un employé depuis Paramètres** | Aucun endroit ne permettait de changer le `nom` d'un profil (l'écran de gestion des rôles ne touchait que `role`/`actif`) — demandé pour que l'admin puisse corriger son propre nom affiché. Champ texte en place de l'affichage statique, sauvegarde à la perte du focus (même patron que le diagnostic d'un bon de travail) — aucune migration ni changement de RLS nécessaire, `profiles_update_self` autorisait déjà l'écriture de `nom` (seul `role` est bloqué en auto-modification, D24) | Un formulaire de modification séparé avec bouton « Enregistrer » — plus de clics pour un champ unique déjà éditable en toute sécurité |
