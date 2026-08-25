-- ============================================================
-- Migration : 2026-08-13 — lecture publique de ref_vehicule_ymm
-- La borne d'accueil (/accueil) n'a pas de session (pas de connexion) :
-- la policy d'origine, limitée à `authenticated`, laissait son menu
-- marque/modèle vide. Ce ne sont que des données publiques (catalogue
-- vPIC + correctifs canadiens, rien de confidentiel) — la lecture
-- ouverte à `anon` est sans risque.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

drop policy "ref_vehicule_ymm_select_all" on ref_vehicule_ymm;

create policy "ref_vehicule_ymm_select_all" on ref_vehicule_ymm
  for select using (true);
