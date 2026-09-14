# Garagenda — système de marque

Source de vérité du design. Les valeurs vivent dans `app/globals.css`
(variables `--mf-*`), branchées dans `tailwind.config.js` sous le préfixe
`mf-*`. Aucun composant ne contient de couleur en dur : toujours
`bg-mf-surface`, jamais `bg-white` ni `#ffffff`. Seules exceptions assumées :
les documents imprimables (évaluation, facture, rapport), posés sur du papier
blanc quel que soit le thème, et les courriels, où les variables CSS ne
fonctionnent pas.

Ce document remplace la version d'août 2026, qui décrivait l'identité
sombre bleu / rouge héritée de MECAFORCE.

---

## 1. Direction

**Denim et laiton.** L'univers du vêtement de travail et de l'atelier : papier,
encre, toile denim, laiton du logo. Précis, sobre, fiable. Pas d'arrondis, pas
d'ombres portées, pas de dégradés : la hiérarchie passe par les filets, les
fonds et la typographie.

Le logo est un G métallique en or. Le laiton en est l'écho dans l'interface,
et c'est le **seul accent** : jamais deux éléments laiton qui se disputent un
même écran.

## 2. Palette

Chaque couple texte / fond est vérifié par **calcul de luminance** (WCAG AA :
4,5:1 pour du texte, 3:1 pour un pictogramme), jamais à l'œil. Refaire le calcul
pour toute nouvelle combinaison.

### Clair — mode principal (`:root`)

| Jeton | Valeur | Rôle | Contraste clé |
|---|---|---|---|
| `bg` | `#F6F5F1` | Papier, fond de page | — |
| `surface` | `#FFFFFF` | Cartes, listes | — |
| `surface-2` | `#EFEDE7` | Survol, en-têtes | — |
| `surface-3` | `#FCFBF8` | Champs de saisie | — |
| `border` / `border-strong` | `#E2DFD6` / `#CFCBC0` | Filets, contours de champ | — |
| `text` | `#111F29` | Encre | 15,4:1 |
| `text-2` | `#5B6770` | Secondaire | 5,3:1 |
| `text-3` | `#6A6962` | Méta, libellés | 4,7:1 sur `surface-2` |
| `blue` | `#1A5C8A` | Denim : actions, liens, sélection | blanc dessus 7,1:1 |
| `signal` | `#E3A21A` | Laiton : repère actif, accent | 7,6:1 sur la barre |
| `signal-fg` | `#94650A` | Laiton en pictogramme ou texte | 5,1:1 |
| `red` | `#B3261E` | Oxyde : problèmes réels | pastille 5,4:1 |
| `success` | `#246B45` | Terminé, payé | pastille 5,4:1 |
| `warning` | `#875A04` | En attente | pastille 5,1:1 |

### Sombre — secondaire (`[data-theme="dark"]`)

Même famille, surfaces et texte inversés. Denim, oxyde et sémantiques
s'éclaircissent pour rester lisibles en texte (`blue #6AAEDB`, `red #F0877F`,
`success #6CC494`, `warning #E8B64A`). Le texte posé sur un aplat denim ou
oxyde suit donc le thème : utiliser **`text-mf-on-blue` / `text-mf-on-red`**,
jamais `text-white` (blanc sur le denim clair du mode sombre : 3,0:1).

### Barre latérale

Toujours encre (`#0F1E29`), quel que soit le thème. Élément actif sur aplat
denim fixe (`sidebar-active`) avec un filet laiton de 3 px à gauche. Logo en or.

## 3. Grammaire des couleurs de statut

Définie une seule fois dans `lib/statuts.ts`. Une couleur dit la même chose
sur toutes les pages.

| Couleur | Sens | Bons de travail | Factures |
|---|---|---|---|
| Ambre | En attente de quelqu'un | Évaluation, Attente pièce | Partielle |
| Bleu | À l'atelier, ça avance | Autorisé, En cours | — |
| Émeraude | Terminé | Terminé | Payée |
| Neutre | Clos | Facturé, Annulé | Annulée |
| Oxyde | Problème | (dépassement d'évaluation) | Impayée |

Le rouge est rare et signifiant. Un bouton destructif en tête de fiche est
**discret** (`variante="danger-discret"`) ; l'aplat rouge est réservé au bouton
de la confirmation, le geste irréversible.

## 4. Typographie

| Rôle | Police | Usage |
|---|---|---|
| Titres, chiffres clés | **Archivo** 700–800 (`font-display`) | Titres de page en majuscules, chiffres du tableau de bord |
| Corps, formulaires | **IBM Plex Sans** 400–600 (`font-sans`) | Tout le texte courant |
| Numéros, montants | **IBM Plex Mono** 400–600 (`font-mono`) | `BT-0006`, `FA-0002`, montants alignés |

Les trois sont auto-hébergées par `next/font`. `text-sm` vaut 15 px (la charte
prescrit un corps entre 15 et 17 px). Libellés : 11 px, majuscules,
interlettrage 0,08 em, `text-mf-text-3`. Montants en colonne :
`tabular-nums`, alignés à droite.

## 5. Formes et espacement

- Rayons : 0 partout (`rounded-mf-*` valent 0). Ombres : aucune.
- Grille de 4 px. Page : `p-6`. Cartes : `p-4`, filet `border-mf-border`.
- Cibles tactiles ≥ 44 × 44 px (décision D17) — non négociable.
- Champs à 16 px sur téléphone (évite le zoom automatique de Safari iOS).

## 6. Composants de référence

- `Bouton` : `primaire` (denim), `secondaire` (contour), `danger` (oxyde plein,
  confirmation seulement), `danger-discret` (entrée de suppression), `discret`.
- `Badge` : tons `rouge`, `ambre`, `bleu`, `emeraude`, `ardoise`, `stone`. Toujours
  passer par `lib/statuts.ts` pour un statut.
- `Pastilles` : filtres exclusifs ; une rangée qui défile au doigt sur
  téléphone, qui passe à la ligne dès la tablette.
- `CadreAuth` : connexion, inscription, mot de passe.
- Listes : une ligne sur tablette et ordinateur, **deux étages sur téléphone**
  (identifiant et état, puis client et montant).

## 7. Écriture

- **Vouvoiement** partout, y compris dans les aides et les textes indicatifs.
- Français du Québec : « Total avant taxes », pas « Total HT » ; « courriel ».
- Dates en clair : « 4 sept. 2026 » en liste (`formatDateCourte`),
  « 4 septembre 2026 » sur les documents (`formatDateLong`) — jamais
  `2026-09-04` à l'écran.
- Pluriels vrais (`pluriel(n, "bon")`) — jamais « bon(s) ».
- Téléphones « 514 555-0142 » (`formatTelephone`), la forme de l'OQLF.
- Un bouton dit ce qu'il fait ; une erreur dit quoi faire.

## 8. Accessibilité — bloquant

- Contraste vérifié par calcul (voir §2).
- Focus visible sur tout élément interactif.
- Jamais d'information portée par la couleur seule : chaque statut a son
  libellé.
- `prefers-reduced-motion` respecté globalement (`app/globals.css`).
