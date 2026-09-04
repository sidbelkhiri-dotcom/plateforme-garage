-- ============================================================
-- Migration : 2026-09-23 — rappels de rendez-vous par texto
--
-- rappel_envoye_le trace si un rappel a déjà été envoyé pour ce
-- rendez-vous — sans ça, une tâche programmée qui tourne plusieurs fois
-- (ou qui est relancée manuellement) enverrait plusieurs textos pour le
-- même rendez-vous.
-- ============================================================

alter table rendez_vous add column rappel_envoye_le timestamptz;
