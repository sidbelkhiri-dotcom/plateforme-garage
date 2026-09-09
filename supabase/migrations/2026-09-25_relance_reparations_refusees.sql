-- ============================================================
-- Migration : 2026-09-25 — relance automatique sur réparations refusées
--
-- Ni Tekmetric ni Shopmonkey n'automatisent bien ce suivi (comparatif
-- indépendant consulté le 8 sept.) — un vrai angle de différenciation,
-- pas juste du rattrapage. Réutilise inspection_points.decision_client
-- = 'refuse' plutôt qu'un nouveau modèle de données.
--
-- relance_envoyee_le trace l'envoi pour éviter les doublons — même
-- patron que rendez_vous.rappel_envoye_le (migration 2026-09-23).
-- ============================================================

alter table inspection_points add column relance_envoyee_le timestamptz;
