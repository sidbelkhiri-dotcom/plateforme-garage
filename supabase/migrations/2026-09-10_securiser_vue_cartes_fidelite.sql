-- ============================================================
-- Migration : 2026-09-10 — sécuriser la vue cartes_fidelite (Security Advisor)
--
-- Une vue Postgres s'exécute par défaut avec les droits de son
-- propriétaire, pas de l'appelant — elle contourne donc la RLS des
-- tables sous-jacentes (clients, factures). Sans ce correctif, un
-- garage B aurait pu lire la progression de fidélité de tous les
-- garages via cartes_fidelite, malgré toute la RLS posée par ailleurs.
-- security_invoker=true (Postgres 15+) fait exécuter la vue avec les
-- droits de l'appelant : elle hérite alors automatiquement du garage_id
-- déjà posé sur clients et factures, sans réécrire la vue elle-même.
-- ============================================================

alter view cartes_fidelite set (security_invoker = true);
