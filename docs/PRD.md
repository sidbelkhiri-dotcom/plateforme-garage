# MECAFORCE — PRD (Product Requirements Document)

**Version :** 1.0 — 12 août 2026
**Statut :** proposition, en attente de validation
**Auteur :** syd, avec Claude

---

## 1. Contexte

MECAFORCE est un garage mécanique au Québec. La gestion se fait aujourd'hui
avec un classeur Excel (`FACTURE_MECAFORCE_V2.xlsb`) pour les factures, et
**des bons de travail papier remplis à la main** pour l'atelier.

L'application est un **outil interne**. Aucun accès client, aucune inscription
publique. Les comptes sont créés par l'administrateur.

**Utilisateurs :** 2 à 4 personnes — un ou deux au comptoir, un ou deux
mécaniciens dans l'atelier.

**Appareils :** les trois comptent.

| Appareil | Usage principal | Conséquence de conception |
|---|---|---|
| Ordinateur au comptoir | Saisie, planning, facturation | Écrans denses, tableaux, raccourcis clavier |
| Tablette dans l'atelier | Consultation et mise à jour du bon de travail | Cibles tactiles ≥ 44 px, texte lisible à 60 cm, pas de survol |
| Téléphone | Consultation rapide en mobilité | Prochain RDV, historique d'un véhicule, recherche client |

**Le responsive n'est pas une finition, c'est une contrainte de départ.** Un bon
de travail doit être utilisable par un mécanicien debout, tablette à la main,
les doigts pas parfaitement propres.

### 1.1 Rôles

Trois rôles, tranchés le 12 août 2026. **Ferme Q4 et Q5** (§8).

| Rôle | Peut | Ne peut pas |
|---|---|---|
| **Administrateur** | Tout ce que font les deux autres, plus : gérer les employés, modifier les **paramètres** (taux horaire, taxes, garantie), supprimer une fiche, consulter les statistiques | — |
| **Réception** | Créer et modifier clients, véhicules, rendez-vous et bons de travail. **Marquer une évaluation acceptée.** Encaisser (V2) | Modifier les paramètres, supprimer une fiche |
| **Mécanicien** | Voir les bons de travail, consulter la fiche véhicule et son historique, écrire le diagnostic, ajouter des lignes pièces et main-d'œuvre, ajouter des notes, changer le statut de **son** bon | Créer un client, modifier les paramètres, **accepter une évaluation**, supprimer quoi que ce soit |

**Deux garde-fous :**

- **L'acceptation d'une évaluation est réservée au comptoir.** C'est l'acte qui
  fige un montant juridiquement engageant (§4.1). Il ne se pose pas depuis la
  tablette, au milieu d'une réparation, les mains dans le moteur.
- Un mécanicien **voit** tous les bons de travail ; il n'**écrit** que sur ceux
  qui lui sont assignés. Un garage de 2 à 4 personnes ne se cloisonne pas en
  lecture — il se protège en écriture.

> **Vocabulaire.** « Ordre de réparation » et « bon de travail » désignent la
> même chose. Le projet retient **bon de travail**, le terme employé à l'atelier.
> Un seul mot dans l'interface comme dans le code (`bons_travail`).

---

## 2. Le problème

Ce qui coince aujourd'hui :

1. **Le bon de travail papier ne laisse aucune trace exploitable.** Une fois la
   réparation faite, l'information n'existe plus que sur une feuille classée
   quelque part. Impossible de répondre à « qu'est-ce qu'on lui a fait la
   dernière fois ? » sans fouiller.
2. **Aucun historique par véhicule.** C'est pourtant l'unité de raisonnement
   naturelle d'un garage.
3. **Aucun kilométrage suivi**, donc aucun rappel d'entretien possible — et le
   rappel d'entretien est le principal levier de retour d'un client.
4. **Le planning n'existe pas.** Pas de vue de la journée, pas de répartition du
   travail entre les mécaniciens.
5. **Le passage papier → Excel est une double saisie** : ce qui a été fait est
   écrit à la main, puis retapé pour facturer.
6. **Risque de conformité.** L'évaluation écrite est obligatoire au-delà de
   100 $ au Québec, avec un contenu précis. Sur papier libre, l'oubli d'une
   mention est facile.

---

## 3. Critère de succès de la V1

> **Le jour où plus aucun bon de travail papier ne sort de l'imprimante ou du
> bloc-notes, et où l'historique complet d'un véhicule tient en un écran.**

La facturation reste sur Excel pendant la V1. Elle est le sujet de la V2, et le
modèle de données de la V1 est conçu pour qu'elle s'y greffe **sans migration**.

Indicateurs concrets :

- Tout véhicule qui entre à l'atelier a un bon de travail dans l'application
- Le kilométrage est saisi à chaque visite, sans exception
- Un mécanicien retrouve l'historique d'un véhicule en moins de 15 secondes
- L'évaluation écrite conforme est produite depuis l'application

---

## 4. Contraintes réglementaires — Québec

**Elles ne sont pas négociables et elles déterminent le modèle de données.**
Sources en fin de document.

### 4.1 Évaluation écrite (avant travaux)

- **Obligatoire dès que les travaux dépassent 100 $**, pièces et main-d'œuvre incluses.
- Contenu obligatoire : identité et adresse du client **et** du garage ;
  caractéristiques du véhicule (marque, modèle, immatriculation) ; description
  précise de la réparation ; **les pièces à installer en précisant si elles sont
  neuves, usagées, réusinées ou remises à neuf** ; prix total ; date de
  l'évaluation et **durée de validité**.
- **Aucune marge de dépassement.** Une fois acceptée, l'évaluation lie les deux
  parties au prix indiqué. Le garage ne peut pas facturer davantage, même si le
  travail a pris plus de temps que prévu.
- **Renonciation :** pour être valide, le client doit **rédiger lui-même** le
  document de renonciation et le signer. Une case à cocher ou une clause
  préimprimée signée ne vaut rien.
- L'évaluation est généralement gratuite ; des frais sont possibles à condition
  d'être annoncés **avant** le travail.

**Conséquences directes sur l'application :**

- Le montant d'évaluation doit être **figé** au moment de l'acceptation, et
  l'application doit **alerter** si le total des travaux le dépasse.
- Chaque ligne de pièce doit porter son **état** (neuve / usagée / réusinée /
  remise à neuf). Ce n'est pas un champ optionnel.
- Une **durée de validité** doit figurer sur le document.
- La renonciation ne peut pas être une case à cocher. Au mieux, l'application
  enregistre qu'une renonciation manuscrite a été obtenue et archivée.

### 4.2 Facture détaillée (après travaux) — cadre la V2

La facture doit contenir : noms et adresses du client et du garage ;
identification du véhicule ; **date de livraison et relevé du compteur
kilométrique** ; réparations effectuées avec **l'état de chaque pièce** ;
**heures de main-d'œuvre, taux horaire et coût total de main-d'œuvre** ; taxes
et total ; **caractéristiques de la garantie**.

**C'est ce qui impose la séparation pièces / main-d'œuvre dans le modèle de
données** — et c'est aussi pour ça que le kilométrage doit être saisi dès la V1,
au bon de travail.

### 4.3 Garantie légale

Sur les pièces **et** la main-d'œuvre : **3 mois ou 5 000 km**, selon la
première échéance. Les corrections sont gratuites dans cette période.

L'application doit pouvoir dire, pour un véhicule qui revient : *cette
réparation est-elle encore sous garantie ?* — ce qui suppose de connaître la
date **et** le kilométrage de la réparation d'origine.

### 4.4 Pièces remplacées

Le garage doit remettre les pièces remplacées au client s'il le demande au
moment de la réparation — sauf réparation sous garantie, échange standard, ou
retour obligatoire au fabricant. Un simple indicateur sur le bon de travail
suffit.

---

## 5. Périmètre V1 — l'atelier au quotidien

### 5.1 Socle (repris de l'existant, corrigé)

| # | Élément |
|---|---|
| S1 | Connexion par courriel / mot de passe, comptes créés en console |
| S2 | Garde d'authentification sur toutes les routes |
| S3 | **Déconnexion** (manquait) |
| S4 | Tableau de bord : journée en cours, véhicules à l'atelier, alertes |
| S5 | Navigation cohérente — **aucune entrée de menu vers une page inexistante** |
| S6 | **Trois rôles** (admin / réception / mécanicien) appliqués par la RLS, jamais par le code — voir §1.1 |

### 5.2 Fonctionnalités V1

| # | Fonctionnalité | Détail |
|---|---|---|
| F1 | **Clients** | Liste, recherche, création, modification, fiche détaillée. Vrais formulaires — plus de `prompt()` |
| F2 | **Véhicules** | Rattachés à un client. Marque, modèle, année, plaque, VIN. Fiche véhicule avec historique complet |
| F3 | **Rendez-vous** | Vue jour et semaine. Création avec client + véhicule + motif + durée estimée. **Assignation à un mécanicien.** Statuts : prévu / confirmé / en cours / terminé / annulé / absent |
| F4 | **Bons de travail** | Le cœur de la V1. Voir §5.3 |
| F5 | **Évaluation écrite** | Générée depuis le bon de travail, conforme §4.1, imprimable / PDF |
| F6 | **Historique par véhicule** | Tous les bons de travail passés, par date décroissante, avec kilométrage et travaux |
| F7 | **Inventaire** | CRUD des pièces, alerte stock bas. Référence, prix d'achat, prix de vente |
| F8 | **Paramètres** | Coordonnées, numéros TPS/TVQ, **taux horaire de main-d'œuvre**, durée de validité des évaluations, garantie affichée |
| F9 | **Employés** | Liste des mécaniciens pour l'assignation (lecture des profils élargie) |

### 5.3 Le bon de travail — pièce maîtresse

Il remplace la feuille papier et suit le véhicule du début à la fin.

**Cycle de vie :**

```
  évaluation  →  autorisé  →  en cours  →  terminé  →  [facturé (V2)]
       │            │
       │            └─ montant d'évaluation FIGÉ ici
       └─ ou renonciation écrite du client
```

**Contenu :**

- Numéro séquentiel (`BT-0001`)
- Client, véhicule, mécanicien assigné, rendez-vous d'origine (optionnel)
- **Kilométrage à l'entrée** — obligatoire
- **Plainte du client** — dans ses mots à lui (« ça fait un bruit au freinage »)
- **Diagnostic** — ce que le mécanicien a trouvé
- **Lignes de travaux**, de deux types :
  - **Pièce** : description, état (neuve/usagée/réusinée/remise à neuf),
    quantité, prix unitaire, lien optionnel vers l'inventaire
  - **Main-d'œuvre** : description, nombre d'heures, taux horaire
- Sous-totaux séparés pièces / main-d'œuvre, et total
- **Alerte visible si le total dépasse le montant d'évaluation accepté**
- Notes internes (non imprimées)
- Pièces remplacées à remettre au client : oui / non
- Dates d'ouverture et de fermeture

**Ce que le mécanicien fait sur la tablette :** ouvrir son bon de travail,
écrire le diagnostic, ajouter des lignes au fur et à mesure, marquer terminé.
Rien d'autre. Cet écran doit être simple au point d'être évident.

### 5.4 Hors périmètre V1 — explicitement

À dire non maintenant pour pouvoir dire oui plus tard :

- Facturation, PDF de facture, paiements → **V2**
- Décrément automatique du stock à la pose d'une pièce → V2
- Rappels d'entretien automatiques (courriel / SMS) → V2
- Fournisseurs et commandes de pièces → V3
- Rapports de chiffre d'affaires et de taxes → V3
- Tableau de bord : **factures impayées** et **chiffre d'affaires** → V2. Les
  deux supposent la facturation, qui n'est pas en V1
- Portail client, prise de RDV en ligne → non prévu
- Application mobile native → non. Le web responsive suffit
- Pointage des heures des employés → non prévu
- Comptabilité → non. L'application n'est pas un logiciel comptable

---

## 6. Parcours utilisateurs

**P1 — Un client appelle pour un rendez-vous.**
Comptoir → recherche du client (ou création) → sélection du véhicule (ou ajout)
→ nouveau RDV : date, heure, durée estimée, motif, mécanicien → confirmé.

**P2 — Le véhicule arrive à l'atelier.**
Comptoir → ouvre le RDV → « créer le bon de travail » → saisit le kilométrage
et la plainte du client → le bon apparaît dans la file du mécanicien.

**P3 — Le mécanicien diagnostique.**
Tablette → son bon de travail → écrit le diagnostic → ajoute les lignes prévues
(pièces + heures) → le total dépasse 100 $ → **l'application demande une
évaluation écrite** → impression / envoi au client.

**P4 — Le client autorise.**
Comptoir → marque l'évaluation acceptée → **le montant est figé** → le bon passe
« autorisé » → le mécanicien peut travailler.

**P5 — Les travaux avancent.**
Tablette → ajout des lignes réelles → si le total dépasse l'évaluation figée,
**bandeau rouge : rappeler le client pour une évaluation complémentaire.**

**P6 — Travaux terminés.**
Bon marqué « terminé », date de fermeture enregistrée. En V1, le comptoir facture
sur Excel à partir du bon. En V2, un bouton génère la facture.

**P7 — Un client revient six mois plus tard.**
Recherche par nom, plaque ou VIN → fiche véhicule → tout l'historique, avec
kilométrages et travaux → « on lui a changé les plaquettes avant à 148 000 km,
il en est à 161 000 aujourd'hui ».

**P8 — Un client revient en disant que ça n'a pas marché.**
Fiche véhicule → réparation d'origine → l'application indique si on est **encore
dans les 3 mois / 5 000 km** de garantie légale.

---

## 7. Backlog après la V1

| Version | Contenu |
|---|---|
| **V2 — Facturation** | Facture générée depuis le bon de travail, PDF conforme §4.2, taxes figées à l'émission, statut de paiement et paiements partiels, décrément du stock |
| **V3 — Fidélisation** | Rappels d'entretien par date et par kilométrage, notifications courriel/SMS avant RDV, relances d'impayés |
| **V4 — Gestion** | Fournisseurs et commandes, marge par pièce et par bon de travail, rapports de chiffre d'affaires, taxes à remettre par période, heures vendues par mécanicien |

---

## 8. Ce qui reste à décider

| # | Question ouverte | Impact |
|---|---|---|
| Q1 | Le projet Supabase précédent existe-t-il encore ? | Base vivante ou schéma rejoué à neuf |
| Q2 | Photo ou copie de ton bon de travail papier actuel | Permet de caler les champs sur ton flux réel plutôt que sur un modèle générique |
| Q3 | Taux horaire de main-d'œuvre — un seul, ou plusieurs (mécanique / diagnostic / carrosserie) ? | Un seul champ en paramètres, ou une table de taux |
| ~~Q4~~ | ~~Rôles et restrictions d'accès~~ | ✅ **Tranché le 12 août 2026** — trois rôles, voir §1.1 |
| ~~Q5~~ | ~~Un mécanicien peut-il créer un client ?~~ | ✅ **Tranché : non.** Réception et administrateur seulement |

---

## Sources

- [Évaluation écrite — Office de la protection du consommateur du Québec](https://www.opc.gouv.qc.ca/commercant/secteur/vehicule/garage/reparation/evaluation)
- [La réparation d'une auto ou d'une moto — Éducaloi](https://educaloi.qc.ca/capsules/la-reparation-dune-auto-ou-dune-moto/)
- [Réparations d'automobiles : connaissez-vous vos droits ? — Protégez-Vous / OPC](https://www.protegez-vous.ca/partenaires/office-de-la-protection-du-consommateur/reparations-automobiles-connaissez-vous-vos-droits)

> Ces éléments sont repris de sources publiques à jour en août 2026. Pour un
> usage engageant la responsabilité du garage, faire valider par un conseiller
> juridique ou directement auprès de l'OPC.
