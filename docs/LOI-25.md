# Loi 25 — conformité de Garagenda

Loi sur la protection des renseignements personnels dans le secteur privé
(RLRQ, c. P-39.1), telle que modifiée par la Loi 25. Ce document dit ce que le
logiciel fait, ce qui reste à faire, et comment réagir. **Ce n'est pas un avis
juridique** : à faire relire par un avocat ou une avocate avant le premier garage
payant.

Sources : [Commission d'accès à l'information — principaux changements](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25),
[responsabilités de l'entreprise](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/responsable-protection-renseignements-personnels-entreprise),
[guide de rédaction d'une politique de confidentialité](https://www.cai.gouv.qc.ca/uploads/pdfs/CAI_GU_POL_Confidentialite.pdf).

---

## 1. Qui est responsable de quoi

| Renseignements | Responsable | Rôle de Garagenda |
|---|---|---|
| Clients d'un garage (fiches, véhicules, bons, factures, photos, demandes en ligne) | **Le garage** | Prestataire : héberge et traite pour le garage, sur ses instructions |
| Comptes des garages et de leurs employés, abonnement | **L'exploitant de Garagenda** | Responsable |

Conséquence : chaque garage doit désigner son responsable et publier son avis ;
Garagenda doit lui en donner les moyens, et tenir ses propres obligations.

## 2. Ce que le logiciel fait (migration 2026-10-13 et suivantes)

| Obligation | Dans Garagenda |
|---|---|
| Responsable désigné, titre et coordonnées publiés | Paramètres → « Protection des renseignements personnels » ; étape du guide de mise en route ; publié sur l'avis public du garage |
| Informer à la collecte (fins, moyens, droits, communication hors Québec) | Avis sous chaque formulaire public + page `/accueil/[slug]/confidentialite` |
| Consentement manifeste, libre, éclairé, à des fins précises, demandé séparément | Case distincte, non cochée, facultative, sur les formulaires publics et la fiche client ; datée par la base (`consentement_communications_le`), impossible à antidater |
| Utilisation limitée aux fins annoncées | Demande d'avis et relance des réparations refusées bloquées sans consentement |
| Accès et portabilité (format structuré, couramment utilisé) | Fiche client → « Exporter » : JSON complet (fiche, véhicules, rendez-vous, bons, factures) |
| Destruction ou anonymisation, sous réserve des délais légaux | Fiche client → « Effacer » : suppression si aucune facture ; sinon anonymisation, les factures gardant l'identité figée à l'émission |
| Conservation limitée | Demandes publiques purgées chaque jour : 90 jours après traitement, un an au plus |
| Pièces comptables conservées intactes (6 ans, lois fiscales) | Identité de l'acheteur et du véhicule figée sur la facture, protégée contre toute modification |
| Pas de technologie d'identification, de localisation ou de profilage | Aucun traceur, aucun outil d'analyse ; témoins de session seulement |
| Sécurité | Cloisonnement par garage éprouvé par `npm run isolation` ; règles vérifiées par `npm run conformite` |

## 3. Ce qui reste à faire avant le premier garage

1. **Responsable de Garagenda** — renseigner `lib/garagenda.ts` (raison sociale,
   nom, titre, courriel). Tant que c'est vide, la politique affiche « version
   préliminaire ».
2. **Évaluation des facteurs relatifs à la vie privée (EFVP)** pour chaque
   prestataire hors Québec (section 4). Obligatoire avant de communiquer des
   renseignements hors du Québec.
3. **Région d'hébergement Supabase** — vérifier dans le tableau de bord
   (Settings → General). Une région canadienne (`ca-central-1`) simplifie
   l'EFVP ; le projet de production est à créer dans la bonne région dès le
   départ, une migration de région étant coûteuse.
4. **Contrats avec les garages** — conditions d'utilisation qui décrivent
   Garagenda comme prestataire : finalités, confidentialité, sécurité, avis
   d'incident au garage, restitution et destruction à la fin du contrat.
5. **Accords de traitement des données** des prestataires (Supabase, Vercel,
   Resend, Twilio, Stripe) — les accepter et les archiver.
6. **Politique de gouvernance** interne (conservation, rôles, plaintes) —
   proportionnée à la taille de l'entreprise.
7. **Suppression à la fin d'un abonnement** — aujourd'hui sur demande ; prévoir
   la procédure (export remis au garage, puis effacement).
8. **Page d'inspection publique** — ajouter le lien vers l'avis du garage.

## 4. EFVP — prestataires (brouillon à compléter)

Pour chacun, l'article 17 demande d'évaluer : la sensibilité des
renseignements, la finalité, les mesures de protection (y compris
contractuelles), et le régime juridique de l'État de destination.

| Prestataire | Renseignements | Finalité | Lieu | Mesures | Évaluation |
|---|---|---|---|---|---|
| Supabase | Toutes les données (base, fichiers, comptes) | Hébergement | À vérifier | Chiffrement, RLS, DPA | À faire |
| Vercel | Transit des requêtes, journaux | Hébergement de l'application | États-Unis (probable) | DPA | À faire |
| Resend | Courriel et nom du destinataire, contenu des évaluations et factures | Envoi de courriels | États-Unis | DPA | À faire |
| Twilio | Numéro de téléphone, texte du rappel | Envoi de textos | États-Unis | DPA | À faire |
| Stripe | Coordonnées de facturation du garage | Abonnement | États-Unis | PCI DSS, DPA | À faire |

## 5. Répondre à une demande d'un client (garage)

Délai : **30 jours**.

1. Vérifier l'identité de la personne.
2. **Accès ou portabilité** : fiche client → Exporter → remettre le fichier JSON.
3. **Correction** : fiche client → Modifier. Une facture émise ne se corrige
   pas : l'annuler et en émettre une nouvelle si l'erreur est sur la facture.
4. **Retrait du consentement** : fiche client → Modifier → décocher la case.
5. **Effacement** : fiche client → Effacer (administrateur). Les factures des six
   dernières années restent, comme la loi l'exige.

## 6. Incident de confidentialité

Accès, utilisation, communication ou perte non autorisés de renseignements.

1. **Contenir** : révoquer l'accès (désactiver le compte, changer les clés).
2. **Évaluer le risque de préjudice sérieux** : sensibilité, conséquences,
   probabilité d'utilisation malveillante.
3. **Si risque sérieux** : aviser avec diligence la Commission d'accès à
   l'information et les personnes concernées. Garagenda avise aussi les
   garages touchés, responsables de leurs clients.
4. **Consigner** chaque incident, même sans risque sérieux, dans le registre
   ci-dessous, et le conserver.

### Registre des incidents

| Date | Description | Renseignements touchés | Personnes (nombre) | Risque sérieux ? | Avis CAI / personnes | Mesures prises |
|---|---|---|---|---|---|---|
| — | Aucun incident à ce jour | | | | | |
