-- ============================================================
-- Migration : 2026-09-17 — fermer PUBLIC sur est_admin_plateforme()
--
-- Même oubli que les fonctions trigger corrigées le 2026-09-12 :
-- est_admin_plateforme() gardait le droit PUBLIC par défaut, hérité par
-- anon. Inoffensif (renvoie toujours false pour anon, aucune fuite),
-- mais fermé par cohérence avec le reste du durcissement.
-- ============================================================

revoke execute on function est_admin_plateforme() from public;
grant execute on function est_admin_plateforme() to authenticated;
