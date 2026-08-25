# Audit design — refonte identité MECAFORCE

Phase 0 uniquement. Aucun fichier de l'application n'a été modifié pour produire ce rapport.

---

## 1. Stack détectée

- **Framework** : Next.js 14.2.35, App Router (pas de Pages Router)
- **Langage** : TypeScript strict (`tsconfig.json`), aucun fichier `.js`/`.jsx` applicatif
- **Bundler** : natif Next.js (Webpack via Next), pas de config custom
- **Rendu** : mélange Server Components (pages en lecture seule : tableau de bord, évaluation écrite, facture imprimable) et Client Components (`"use client"` pour tout le CRUD)
- **Backend** : Supabase (Postgres + Auth + RLS), consommé directement depuis le navigateur — pas d'API intermédiaire à toucher pour cette refonte
- **Déploiement** : Vercel, déploiement automatique sur push vers `main`
- **Dépendances runtime** : `@supabase/ssr`, `@supabase/supabase-js`, `lucide-react` (icônes), `next`, `react` — c'est tout. Aucune lib UI.

## 2. Système de style actuel

**Tailwind CSS pur**, classes utilitaires écrites directement dans le JSX. Aucune lib de composants (pas de MUI, shadcn/ui, Ant, Bootstrap, Chakra…), aucun CSS Modules, aucun styled-components, aucun SCSS.

- `tailwind.config.js` : configuration par défaut, `theme.extend` **vide** — aucun token de marque déclaré, palette 100 % celle par défaut de Tailwind (`amber`, `slate`, `stone`, `emerald`, `red`)
- `app/globals.css` : 25 lignes. Juste les 3 directives `@tailwind`, un reset `height: 100%`, et une règle `@media print` pour cacher la barre latérale à l'impression (documents légaux imprimables — évaluation écrite, facture)
- **Aucune variable CSS custom** (`:root { --* }`) nulle part dans le projet
- **Aucun style inline** (`style={{ }}`) : 0 occurrence
- **Aucune couleur hex/rgb en dur** : 0 occurrence — tout passe déjà par les classes Tailwind
- **Aucun mode sombre** : 0 occurrence de `dark:`, pas de `ThemeProvider`, pas de détection `prefers-color-scheme`. Le dark-first demandé est une **capacité entièrement nouvelle**, pas un remap d'un dark mode existant

## 3. Où vivent les couleurs aujourd'hui

Nulle part de centralisé — chaque fichier choisit ses classes Tailwind directement. 31 fichiers référencent des couleurs sémantiques (`amber-*`, `slate-*`, `stone-*`, `emerald-*`, `red-*`). Les plus denses :

| Fichier | Occurrences couleur |
|---|---|
| `app/bons-travail/[id]/page.tsx` | ~30 |
| `app/bons-travail/[id]/evaluation/page.tsx` | ~20 |
| `app/clients/[id]/page.tsx` | ~15 |
| `app/factures/[id]/page.tsx` | ~20 |
| `app/vehicules/[id]/page.tsx` | ~15 |
| `app/page.tsx` (tableau de bord) | ~25 |
| `components/Sidebar.tsx` | ~10 |
| `components/ui/Badge.tsx` | logique de tons centralisée (voir §6) |

La seule tentative de centralisation existante : `components/ui/Badge.tsx` définit un objet `TONES` (`rouge`/`emeraude`/`ambre`/`ardoise`/`stone` → classes Tailwind) — c'est le point d'entrée le plus proche d'un design token dans tout le repo, et probablement le meilleur endroit pour brancher les nouveaux tokens sémantiques (`success`/`warning`/`danger`/`info`).

## 4. Inventaire des écrans

16 pages (`app/**/page.tsx`) + 1 layout racine :

| Route | Fichier | Type |
|---|---|---|
| `/` | `app/page.tsx` | Tableau de bord (Server Component) |
| `/login` | `app/login/page.tsx` | Connexion |
| `/accueil` | `app/accueil/page.tsx` | Borne publique (sans connexion) |
| `/clients` | `app/clients/page.tsx` | Liste clients |
| `/clients/[id]` | `app/clients/[id]/page.tsx` | Fiche client |
| `/vehicules/[id]` | `app/vehicules/[id]/page.tsx` | Fiche véhicule + historique |
| `/rendez-vous` | `app/rendez-vous/page.tsx` | Calendrier jour/semaine |
| `/demandes-accueil` | `app/demandes-accueil/page.tsx` | Traitement des arrivées (borne) |
| `/bons-travail` | `app/bons-travail/page.tsx` | Liste bons de travail |
| `/bons-travail/nouveau` | `app/bons-travail/nouveau/page.tsx` | Création d'un bon |
| `/bons-travail/[id]` | `app/bons-travail/[id]/page.tsx` | Détail bon (le plus dense) |
| `/bons-travail/[id]/evaluation` | `.../evaluation/page.tsx` | **Document imprimable** (légal, Server Component) |
| `/factures` | `app/factures/page.tsx` | Liste factures |
| `/factures/[id]` | `app/factures/[id]/page.tsx` | **Document imprimable** (légal, Server Component) |
| `/inventaire` | `app/inventaire/page.tsx` | Stock de pièces |
| `/parametres` | `app/parametres/page.tsx` + `ParametresClient.tsx` | Paramètres du garage |
| — | `app/layout.tsx` | Layout racine (Sidebar + shell) |

⚠️ **Deux pages sont des documents légaux imprimables** (évaluation écrite conforme OPC, facture conforme). Elles ont une règle `@media print` dédiée et une classe `.sans-impression`. La refonte doit préserver ce comportement à l'identique — un document légal illisible ou mal imprimé n'est pas juste un bug visuel.

## 5. Inventaire des composants réutilisables

`components/ui/` (11) :
`Badge`, `Bouton`, `Champ`, `ChampRecherche`, `Chargement`, `EtatVide`, `MessageErreur`, `Modale`, `ModaleConfirmation`, `Selecteur`, `Tableau`

`components/forms/` (5, spécifiques métier — pas des composants génériques à thémiser au sens strict, mais consomment `Champ`/`Selecteur`/`Bouton`) :
`FormulaireClient`, `FormulaireInventaire`, `FormulaireLigneBon`, `FormulaireRendezVous`, `FormulaireVehicule`

Racine `components/` (3) :
`Sidebar` (nav + shell responsive), `LogoutButton`, `BoutonImprimer`

**Composants demandés par le brief qui n'existent pas encore** et seraient à créer en Phase 2 : `Toast`, `Tooltip`, `Tabs`, `Pagination`, `Skeleton` (actuellement `Chargement` est un simple spinner texte, pas un skeleton), `BrandStripes`.

**Composants qui existent mais ne sont pas dans le brief** : `ChampRecherche`, `MessageErreur`, `EtatVide` — à conserver, juste à réthémiser.

## 6. Dette visuelle

- **Couleurs** : 0 hex/rgb en dur, mais 0 token non plus — 31 fichiers avec des classes de couleur Tailwind directes, aucune indirection. C'est la dette principale : chaque `amber-700` est écrit à la main partout, rien à changer une seule fois.
- **`amber-500` résiduel** (7 occurrences, `grep` à l'appui) : toutes décoratives et déjà documentées comme volontaires dans le journal de décisions (`docs/DESIGN.md`, D28) — icônes, bordure de sélection, point de statut. Aucune n'est un problème de contraste actif, mais elles disparaîtront naturellement avec la nouvelle palette.
- **Valeurs arbitraires Tailwind** (`w-[44px]`, `text-[11px]`, etc.) : 60 occurrences, mais **quasiment toutes intentionnelles et documentées** — `44px` = cible tactile minimale (WCAG, décision D17), `11px` = taille des libellés `caption`/en-tête de tableau. Ce n'est pas du bruit, c'est déjà proche de l'échelle typographique que le brief demande (`caption 11px`). À faire correspondre aux nouveaux tokens plutôt qu'à supprimer.
- **Radius** : usage cohérent (`rounded`, `rounded-lg`, `rounded-full`) sans valeurs custom — mappage direct possible vers `--mf-radius-sm/md/lg/pill`.
- **Duplication** : les pages `bons-travail/[id]/page.tsx` et `bons-travail/[id]/evaluation/page.tsx` dupliquent des dictionnaires `LABEL_STATUT`/`TON_STATUT` (répétés dans au moins 4 fichiers : `bons-travail/page.tsx`, `bons-travail/[id]/page.tsx`, `vehicules/[id]/page.tsx`, `factures/page.tsx`, `factures/[id]/page.tsx`). Pas strictement une dette *visuelle*, mais la Phase 2 (composant `Badge` centralisé + tokens sémantiques) est l'occasion naturelle de factoriser ça aussi — je le signale sans le faire, ça reste hors périmètre "présentation uniquement" au sens strict.
- **Pas de mode sombre** : à construire de zéro, pas à migrer.
- **Aucun test automatisé** (pas de Playwright, pas de Jest) dans le repo — la vérification "avant/après par capture" et "aucun test cassé" du brief devra se faire manuellement, à la main, dans le navigateur (c'est déjà la pratique du projet — voir `docs/PLAN.md` règle 2 : "aucune tâche cochée sans vérification manuelle").

## 7. Plan d'exécution proposé

| Phase | Contenu | Risque | Pourquoi |
|---|---|---|---|
| **1 — Fondations** | Tokens CSS (`:root`), polices (Saira + Inter via `next/font` — pas de CDN externe, cohérent avec Vercel), reset, `BRAND.md` | 🟢 Faible | Aucun écran touché, rien ne peut casser visuellement |
| **2 — Composants de base** | Réthémiser les 11 composants `ui/` existants + créer `BrandStripes`, `Skeleton`, `Tooltip`, `Tabs`, `Pagination`, `Toast` | 🟡 Moyen | Composants partagés = effet de bord large si une régression passe inaperçue ; mais surface de test réduite (11-17 fichiers, pas 16 pages) |
| **3 — Coquille applicative** | `Sidebar`, layout, écran de connexion | 🟡 Moyen | Visible sur 100 % des pages en permanence — toute erreur saute aux yeux immédiatement (avantage : détection rapide) |
| **4 — Écrans** | Page par page, dans cet ordre suggéré : tableau de bord → bons de travail (liste + détail, le cœur du produit) → clients/véhicules → factures → rendez-vous/inventaire/paramètres → **`/accueil` et `/demandes-accueil` en dernier** (bornes publiques, moins critiques) | 🟠 Plus élevé sur 2 pages précises | **`bons-travail/[id]/evaluation` et `factures/[id]` sont des documents légaux imprimables** — la seule étape de cette refonte où une erreur a une conséquence réelle (document illisible remis à un client). À traiter avec une vérification d'impression dédiée, pas juste un coup d'œil à l'écran |
| **5 — Finitions** | Assets de marque (SVG des 3 barres, favicons), meta/manifest, pages d'erreur, revue globale | 🟢 Faible | Périphérique, aucun impact sur les écrans métier déjà validés |

**Points d'attention spécifiques au projet, au-delà du brief générique :**

1. **Contraste à recalculer, pas à deviner.** Le projet a déjà été corrigé une fois pour de vrais échecs de contraste WCAG (D28 : `amber-500` sur blanc = 2.15:1, corrigé à `amber-700` = 5.02:1 ; D29 : `stone-400` = 2.52:1, corrigé à `stone-500`). La nouvelle palette bleu/navy sur fond très sombre (`--mf-bg: #060B16`) devra être vérifiée avec les mêmes calculs de luminance réelle, pas une lecture visuelle — en particulier `--mf-text-3` (`#6B7890`) sur `--mf-surface-3` (`#18243A`), qui est la combinaison la plus à risque de tout le système proposé.
2. **44px de cible tactile est déjà acquis** (D17) — la refonte doit le préserver partout, c'est un des seuls invariants non négociables du projet actuel.
3. **`America/Toronto` et le calcul de dates n'a rien à voir avec cette refonte** — aucun risque de ce côté, simple note pour confirmer le périmètre.
4. **Le mot "MECAFORCE" existe déjà en toutes lettres** dans `components/Sidebar.tsx`, `app/login/page.tsx`, et les métadonnées de `app/layout.tsx` (`title: "MECAFORCE — Gestion d'atelier"`) — pas de renommage, juste un habillage.

---

**Fin de la Phase 0. Aucun fichier applicatif modifié — seul ce rapport a été créé.** En attente du feu vert pour la Phase 1.
