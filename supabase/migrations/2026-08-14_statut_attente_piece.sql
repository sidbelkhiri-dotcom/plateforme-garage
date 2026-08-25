-- ============================================================
-- Migration : 2026-08-14 — statut "en attente de pièce"
-- S'insère entre en_cours et terminé : un mécanicien qui manque une
-- pièce met le bon en pause plutôt que de laisser un statut trompeur.
-- On y revient toujours vers en_cours — jamais un raccourci direct vers
-- terminé, pour garder un seul chemin de sortie clair.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table bons_travail drop constraint bons_travail_statut_check;
alter table bons_travail add constraint bons_travail_statut_check
  check (statut in ('evaluation', 'autorise', 'en_cours', 'attente_piece', 'termine', 'facture', 'annule'));
