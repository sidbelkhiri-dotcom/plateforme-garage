-- ============================================================
-- Migration : 2026-09-21 — tracer l'import d'un point approuvé
--
-- Le bouton « Ajouter au bon » (InspectionClient.tsx) crée une ligne de
-- brouillon dans bon_travail_lignes à partir d'un point d'inspection
-- approuvé. Sans trace persistante de ce geste, un rechargement de page
-- puis un second clic dupliquerait la ligne — un vrai risque sur des
-- montants facturables, pas une simple redondance visuelle.
-- ============================================================

alter table inspection_points add column importe_le timestamptz;
