-- ============================================================
-- Migration : 2026-08-22 — envoi du devis (évaluation écrite) par courriel
-- Même principe que l'envoi de facture (2026-08-17_envoi_courriel_facture.sql) :
-- une copie envoyée au client sert de preuve qu'il a confirmé le prix
-- avant les travaux. Colonnes sur bons_travail, pas sur
-- bon_travail_evaluations, puisque l'envoi reflète l'état courant du
-- devis (montant_evaluation actuel), pas un envoi ligne par ligne.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table bons_travail add column evaluation_envoyee_le timestamptz;
alter table bons_travail add column evaluation_envoyee_a text;
