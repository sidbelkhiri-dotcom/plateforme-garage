-- ============================================================
-- Migration : 2026-09-27 — NIV sur la borne d'accueil
--
-- Porte la fonctionnalité déjà en production sur MECAFORCE (décodage
-- automatique du NIV via NHTSA vPIC) vers Garagenda.
-- ============================================================

alter table demandes_accueil add column vin text;
