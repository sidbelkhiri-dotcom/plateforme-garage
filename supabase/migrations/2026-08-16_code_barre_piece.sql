-- ============================================================
-- Migration : 2026-08-16 — code-barres et date d'installation par pièce
-- Trace individuelle par pièce posée (pas seulement par bon de travail) :
-- utile pour retrouver la pièce exacte si le client revient en garantie.
-- ============================================================

alter table bon_travail_lignes
  add column code_barre text,
  add column installee_le date;
