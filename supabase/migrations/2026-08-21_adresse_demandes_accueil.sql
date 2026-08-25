-- ============================================================
-- Migration : 2026-08-21 — adresse et code postal sur la borne d'accueil
-- Ajoute deux champs facultatifs au formulaire public /accueil, repris
-- ensuite dans la validation par la réception (voir demandes-accueil).
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table demandes_accueil add column adresse text;
alter table demandes_accueil add column code_postal text;
