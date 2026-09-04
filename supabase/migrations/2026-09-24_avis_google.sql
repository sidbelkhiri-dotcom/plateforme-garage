-- ============================================================
-- Migration : 2026-09-24 — demande d'avis Google
--
-- lien_avis_google : URL vers la fiche Google Business du garage,
-- configurée une fois dans Paramètres — utilisée par le bouton "Demander
-- un avis" sur une facture (app/api/demander-avis/route.ts).
-- ============================================================

alter table parametres add column lien_avis_google text;
