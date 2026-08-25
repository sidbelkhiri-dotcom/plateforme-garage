-- ============================================================
-- Migration : 2026-08-22 — corriger l'ambiguïté sur creer_facture()
-- 2026-08-13_facturation_v2.sql a créé creer_facture(uuid, date).
-- 2026-08-17_facture_sans_taxe.sql a créé une SURCHARGE distincte
-- creer_facture(uuid, date, boolean default false) au lieu de remplacer
-- la première (Postgres traite un nombre de paramètres différent comme
-- une fonction différente, même avec un défaut). Les deux ont coexisté
-- tant que le code appelait toujours la version à 3 arguments —
-- retirer l'option "Sans taxe" de l'interface a fait retomber les
-- appels à 2 arguments, rendant les deux fonctions ambiguës.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

drop function if exists creer_facture(uuid, date);
