-- ============================================================
-- Migration : 2026-09-12 — révoquer PUBLIC sur les fonctions trigger
--
-- La migration précédente révoquait EXECUTE pour anon/authenticated
-- nommément, mais ces fonctions gardaient encore le droit accordé au
-- rôle PUBLIC (comportement par défaut de Postgres à la création d'une
-- fonction) — et PUBLIC est hérité automatiquement par tous les rôles,
-- anon et authenticated compris. Le Security Advisor le confirme : ces
-- fonctions restaient exécutables après la migration précédente.
--
-- Les 6 fonctions de facturation (creer_facture, etc.) n'ont pas ce
-- problème : leurs migrations d'origine avaient déjà fait
-- `revoke ... from public` explicitement.
-- ============================================================

revoke execute on function handle_new_user() from public;
revoke execute on function protect_profile_role() from public;
revoke execute on function proteger_autorisation_bon() from public;
revoke execute on function decrementer_stock_bon() from public;
revoke execute on function set_updated_at() from public;
revoke execute on function maj_statut_facture() from public;
revoke execute on function proteger_montants_facture() from public;
revoke execute on function fixer_garage_bon_travail_evaluations() from public;
revoke execute on function fixer_garage_bon_travail_lignes() from public;
revoke execute on function fixer_garage_facture_lignes() from public;
revoke execute on function fixer_numero_bon_travail() from public;
revoke execute on function fixer_numero_facture() from public;
revoke execute on function revoquer_inspections_bon() from public;
