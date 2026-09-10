-- ============================================================
-- Migration : 2026-09-28 — Taux horaire négocié par client
--
-- Une flotte ne paie pas le taux du particulier. Jusqu'ici le garage
-- n'avait qu'un taux global dans `parametres`, ce qui rendait impossible
-- toute entente avec un client à volume.
--
-- La colonne est NULLABLE à dessein : null signifie « applique le taux du
-- garage ». Un défaut à 0 ferait facturer la main-d'œuvre gratuitement
-- pour tous les clients existants, ce qui est exactement le genre
-- d'erreur silencieuse qu'on ne remarque qu'au moment de la facture.
--
-- Rien à changer côté sécurité : la table clients est déjà cloisonnée par
-- garage_id, et une nouvelle colonne hérite de ces politiques.
--
-- Rien à changer non plus côté immuabilité légale. Le taux est recopié
-- sur le bon de travail au moment de sa création (bons_travail.taux_horaire,
-- not null) et n'est plus jamais relu depuis le client ensuite : modifier
-- le tarif d'un client ne peut donc pas altérer un bon déjà ouvert ni une
-- évaluation déjà acceptée.
-- ============================================================

alter table clients add column taux_horaire numeric(10,2);

comment on column clients.taux_horaire is
  'Taux horaire négocié avec ce client. NULL = utiliser parametres.taux_horaire du garage. Recopié sur le bon de travail à sa création, jamais relu ensuite.';
