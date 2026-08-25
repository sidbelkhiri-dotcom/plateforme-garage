-- ============================================================
-- Migration : 2026-08-21 — code postal sur les clients
-- Affiché séparément de l'adresse sur les factures / reçus de paiement.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table clients add column code_postal text;
