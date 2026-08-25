# MECAFORCE — Système de marque

Refonte visuelle vers l'identité MECAFORCE (bleu / navy / rouge, trois barres
inclinées). Ce document est la source de vérité — toute la Phase 2 et
suivantes s'y réfèrent. Voir `DESIGN_AUDIT.md` pour l'audit qui a précédé ce
document (Phase 0).

**Où vivent les tokens :** `app/globals.css` (variables CSS sur `:root` et
`:root[data-theme="light"]`), branchés dans `tailwind.config.js` sous le
préfixe `mf-*`. Aucun composant ne doit contenir une couleur en dur — toujours
`bg-mf-surface`, jamais `bg-white` ou `bg-[#0B1220]`.

---

## 1. Concept directeur

Trois barres parallèles inclinées (bleu / navy / rouge) = motif signature.
Vitesse, bandes de course, puissance mécanique. Présent de façon subtile et
récurrente — **jamais plus d'une occurrence visible par écran**. Si le motif
est partout, il ne signifie plus rien.

Mots-clés : précis, technique, rapide, fiable, haut de gamme. Pas de fun, pas
d'arrondi mignon, pas de dégradé pastel, pas de glassmorphism, pas de néon.

## 2. Palette

### Mode sombre — mode principal (`:root`, sans attribut)

| Token | Valeur | Usage |
|---|---|---|
| `--mf-bg` | `#060B16` | Fond application |
| `--mf-surface` | `#0B1220` | Cards, panneaux |
| `--mf-surface-2` | `#111A2C` | Éléments surélevés, hover de ligne |
| `--mf-surface-3` | `#18243A` | Inputs, éléments enfoncés |
| `--mf-border` | `#1E2A44` | Séparateurs discrets |
| `--mf-border-strong` | `#2C3B5C` | Contours de champs, base du focus ring |
| `--mf-text` | `#F5F7FA` | Titres, texte principal |
| `--mf-text-2` | `#A8B3C7` | Texte secondaire, labels |
| `--mf-text-3` | `#8892A6` | Texte désactivé, placeholders, méta |
| `--mf-blue` | `#0B5BE8` | Action primaire (remplissages, boutons) |
| `--mf-blue-hover` | `#2A74FF` | Survol de bouton, **et texte/lien bleu sur fond sombre** |
| `--mf-blue-soft` | `rgba(11,91,232,.14)` | Fonds de badges/états |
| `--mf-navy` | `#1B2A5C` | Structurel — bandes décoratives, surfaces de marque |
| `--mf-red` | `#E01B24` | Destructif, alerte critique |
| `--mf-red-hover` | `#F03A42` | Survol destructif |
| `--mf-red-soft` | `rgba(224,27,36,.14)` | Fonds de badges/états |
| `--mf-success` / `-soft` | `#22C55E` | Sémantique positif |
| `--mf-warning` / `-soft` | `#F59E0B` | Sémantique attention |
| `--mf-danger` | = `--mf-red` | Alias sémantique |
| `--mf-info` | = `--mf-blue` | Alias sémantique |

### Mode clair — secondaire (`:root[data-theme="light"]`)

| Token | Valeur |
|---|---|
| `--mf-bg` | `#F4F6FA` |
| `--mf-surface` | `#FFFFFF` |
| `--mf-surface-2` | `#EFF2F7` |
| `--mf-surface-3` | `#E7EBF2` |
| `--mf-border` | `#DDE3ED` |
| `--mf-border-strong` | `#C3CCDA` |
| `--mf-text` | `#0B1220` |
| `--mf-text-2` | `#4A566B` |
| `--mf-text-3` | `#5B6B85` |

Les couleurs de marque (bleu/navy/rouge/sémantique) ne changent pas entre les
deux modes — seules les surfaces et le texte sont remplacés.

**Activation** : `data-theme="light"` posé sur `<html>` par un script
bloquant dans `app/layout.tsx` (lit `localStorage['mf-theme']`, évite le flash
de mauvais thème). Pas d'interrupteur visible tant que la Phase 3 n'a pas posé
le bouton dans la barre latérale — en attendant, le mode sombre s'applique
toujours par défaut, quelle que soit la préférence système. C'est un choix
délibéré (« mode principal » = celui de la marque, pas celui de l'OS) —
signalez-le si vous préférez suivre `prefers-color-scheme` à la place.

### Discipline chromatique — non négociable

- Le **bleu** est la couleur d'action (CTA primaire, liens, état actif, sélection).
- Le **rouge** est rare et signifiant : destruction, alerte critique. Jamais un
  bouton « Enregistrer » en rouge.
- Le **navy** est structurel : bandes décoratives, en-têtes, surfaces de marque.
- Aucune autre couleur d'accent (pas de violet, orange, teal…) hors la palette
  sémantique ci-dessus.
- Interdiction totale des couleurs en dur dans les composants.

### ⚠️ Écarts au brief d'origine — vérifiés par calcul de luminance réel (pas à l'œil)

Le projet a déjà été corrigé une fois pour de vrais échecs de contraste WCAG
(voir `docs/DESIGN.md`, D28/D29) — même discipline appliquée ici :

| Combinaison | Valeur brief | Ratio réel | Verdict | Valeur retenue |
|---|---|---|---|---|
| `--mf-text-3` sur `--mf-surface-3` (sombre) | `#6B7890` | 3.49:1 | **Échec AA** (texte normal, seuil 4.5) | `#8892A6` → 4.96:1 |
| `--mf-blue` en **texte** sur `--mf-bg` | `#0B5BE8` | 3.44:1 | **Échec AA** | Utiliser `--mf-blue-hover` (`#2A74FF`) pour le bleu en texte/lien → 4.72:1 |
| `--mf-blue` en **fond de bouton** (texte blanc) | `#0B5BE8` | 5.71:1 | ✅ Passe déjà | Inchangé — ne pas assombrir davantage (le brief anticipait un possible ajustement, pas nécessaire) |
| `--mf-text-3` (clair) sur `--mf-surface-2` clair | `#6B7890` | 3.97:1 | **Échec AA** | `#5B6B85` → 4.82:1 |
| `--mf-red` en fond de bouton (texte blanc) | `#E01B24` | 4.83:1 | ✅ Passe | Inchangé |

**Règle pratique retenue : `--mf-blue` pour les remplissages (boutons, fonds
pleins), `--mf-blue-hover` pour le bleu utilisé comme couleur de texte sur
fond sombre** (liens, icônes actives). Les deux existaient déjà dans le brief
comme tokens séparés — on leur donne juste un rôle distinct plutôt que
purement « repos / survol ».

## 3. Typographie

- **Titres / chiffres clés / labels de nav** : `Saira` (poids 700/900),
  majuscules, letter-spacing légèrement ouvert. Chargée via `next/font/google`
  (auto-hébergée par Next au build — aucun appel réseau à Google au
  chargement, donc rien à ajouter au CSP). Variable CSS : `--font-saira`,
  classe Tailwind `font-display`.
- **Corps de texte / formulaires / tableaux** : `Inter` (400/500/600),
  également auto-hébergée. Variable `--font-inter`, classe `font-sans`
  (devient la police par défaut de tout le corps de texte dès cette phase).
- **Données numériques dans les tableaux** : `font-variant-numeric:
  tabular-nums` — à ajouter en Phase 2 sur les cellules de montants.
- Italique légère (skew) uniquement sur les **très gros titres de page**, pas
  sur les titres de section — à faire au cas par cas en Phase 4, pas un
  utilitaire global.

### Échelle

| Nom | Taille / poids | Cas |
|---|---|---|
| `display` | 34px / 700 / uppercase / ls 0.02em | Titre de page principal |
| `h1` | 26px / 700 / uppercase / ls 0.02em | — |
| `h2` | 20px / 600 | — |
| `h3` | 16px / 600 | En-tête de card |
| `body` | 14px / 400 / line-height 1.55 | — |
| `small` | 13px / 400 | — |
| `caption` | 11px / 600 / uppercase / ls 0.08em / `--mf-text-3` | Déjà utilisé dans le projet actuel (labels de champ, en-têtes de tableau) — juste à rebrancher sur les tokens |

## 4. Espacement, rayons, élévation

Grille : 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (multiples de 4 uniquement).
Le projet respecte déjà cette discipline via les classes Tailwind standard —
rien à changer côté espacement.

| Token | Valeur | Usage |
|---|---|---|
| `--mf-radius-sm` (`rounded-mf-sm`) | 6px | Inputs, badges |
| `--mf-radius-md` (`rounded-mf-md`) | 10px | Boutons, cards |
| `--mf-radius-lg` (`rounded-mf-lg`) | 14px | Modals, panneaux principaux |
| `--mf-radius-pill` (`rounded-mf-pill`) | 999px | Pills de statut uniquement |
| `--mf-shadow-sm/md/lg` (`shadow-mf-sm/md/lg`) | — | En mode sombre, la profondeur vient d'abord de la surface + bordure 1px ; l'ombre est un renfort, pas l'inverse |

## 5. Le motif signature « 3 barres »

À construire en Phase 2 : composant `<BrandStripes />` (`components/ui/`).
Trois parallélogrammes inclinés à -15°, bleu → navy → rouge, espacement
régulier. Props : `size`, `orientation`, `opacity`.

Usages prévus (maximum un par écran) :
- En-tête d'application, à côté du nom de la page.
- Accent 3px en haut des cards mises en avant (KPI, élément sélectionné).
- État vide / chargement / page 404, en filigrane très faible opacité.
- Écran de connexion : grande version en fond, opacité ≤ 6 %.

## 6. Règles par composant

Résumé — le détail s'écrit au fil de la Phase 2, dans le composant lui-même.

- **Boutons** : primaire = fond `--mf-blue`, texte blanc, `rounded-mf-md`,
  40px (36px dense), poids 600. Secondaire = transparent + bordure
  `--mf-border-strong`. Ghost = pas de bordure, hover `--mf-surface-2`.
  Destructif = `--mf-red`. Focus = anneau 2px `--mf-blue` offset 2px, jamais
  supprimé sans remplacement. Transition `150ms cubic-bezier(.2,.8,.2,1)`,
  `translateY(-1px)` au survol des primaires.
- **Champs** : fond `--mf-surface-3`, bordure `--mf-border-strong`,
  `rounded-mf-sm`, 40px. Focus = bordure `--mf-blue` + halo `0 0 0 3px
  var(--mf-blue-soft)`. Erreur = bordure `--mf-red` + message texte (jamais la
  couleur seule — le projet respecte déjà cette règle, D15).
- **Cards** : fond `--mf-surface`, bordure 1px `--mf-border`,
  `rounded-mf-md`, padding 20–24px.
- **Tableaux** : en-tête `--mf-surface-2` + `caption`, sticky au scroll.
  Lignes 48px, séparateur `--mf-border`, hover `--mf-surface-2`. Ligne
  sélectionnée = `--mf-blue-soft` + barre 3px `--mf-blue` à gauche. Montants
  alignés à droite, tabular-nums.
- **Navigation** (`Sidebar.tsx`) : fond `--mf-bg`, bordure droite
  `--mf-border`. Item actif = `--mf-surface-2` + barre 3px `--mf-blue` à
  gauche (inclinée -15°, rappel du motif). Item inactif = `--mf-text-2`,
  hover `--mf-text`.
- **Badges** : pill, fond `*-soft`, texte couleur pleine, `caption`
  majuscules, hauteur 22px. Brancher `components/ui/Badge.tsx` (déjà le point
  le plus centralisé du projet) sur les tokens sémantiques en premier.
- **Modals** : overlay `rgba(6,11,22,.72)` + `backdrop-filter: blur(4px)`,
  panneau `--mf-surface-2`, `rounded-mf-lg`, largeur max 560px.
- **Toasts** (composant à créer) : ancrés bas-droite, barre 3px gauche selon sévérité.
- **Skeletons** (composant à créer, remplace le spinner actuel de
  `Chargement.tsx`) : `--mf-surface-2` + shimmer subtil, jamais de spinner
  plein écran.

## 7. Accessibilité — bloquant

- Contraste ≥ 4.5:1 texte normal, ≥ 3:1 texte large — **vérifié par calcul de
  luminance réel**, jamais à l'œil (voir tableau d'écarts §2). Refaire ce
  calcul pour toute nouvelle combinaison introduite en Phase 2+.
- Tout élément interactif a un état focus visible.
- Aucune information transmise par la seule couleur.
- `prefers-reduced-motion` respecté — déjà en place globalement dans
  `app/globals.css` depuis cette phase.
- Cibles tactiles ≥ 44×44px — **déjà acquis dans le projet actuel** (décision
  D17), à préserver telle quelle, pas à réinventer en 40×40 comme le
  suggérait le brief générique.

## 8. Ce qui reste hors de cette phase

- Documents légaux imprimables (`bons-travail/[id]/evaluation`,
  `factures/[id]`) : traités en dernier en Phase 4, avec vérification
  d'impression dédiée — un document illisible remis à un client n'est pas
  qu'un bug visuel.
- Assets de marque (SVG des 3 barres, favicons) : Phase 5.
- Interrupteur de thème visible : Phase 3 (barre latérale).
