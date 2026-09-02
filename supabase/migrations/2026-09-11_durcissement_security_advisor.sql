-- ============================================================
-- Migration : 2026-09-11 — durcissement suite au Security Advisor
--
-- Tri des 51 avertissements :
--
--   RÉGLÉS ICI
--   - function_search_path_mutable (7 fonctions historiques, jamais
--     corrigées) — durcissement recommandé par le linter, même sans
--     scénario d'exploitation démontrable.
--   - anon/authenticated_security_definer_function_executable — deux
--     familles distinctes :
--       (a) fonctions déclenchées uniquement par trigger
--           (handle_new_user, protect_profile_role,
--           proteger_autorisation_bon, decrementer_stock_bon,
--           set_updated_at, maj_statut_facture,
--           proteger_montants_facture, fixer_garage_*, fixer_numero_*,
--           revoquer_inspections_bon) : jamais censées être appelées en
--           RPC direct. Révoquer EXECUTE ne les empêche pas de se
--           déclencher normalement — un trigger n'a pas besoin du droit
--           d'exécution du rôle appelant.
--       (b) accepter_evaluation, annuler_facture, creer_facture,
--           enregistrer_paiement, reevaluer_bon, renoncer_evaluation :
--           déjà protégées par est_role() dans leur corps (un appel anon
--           échoue proprement), mais anon avait quand même EXECUTE —
--           défense en profondeur, jamais démontré exploitable.
--   - public_bucket_allows_listing (vehicules-stock) : la policy SELECT
--     permettait de LISTER tous les fichiers, tous garages confondus.
--     L'accès direct par URL publique n'est pas affecté (il ne passe pas
--     par cette policy) — seule l'énumération est fermée.
--
--   PAS D'ACTION (intentionnel, déjà documenté dans les migrations
--   d'origine)
--   - rls_policy_always_true sur demandes_accueil / demandes_rendez_vous :
--     écriture publique volontaire (bornes sans connexion), le pire cas
--     est une ligne à ignorer.
--   - obtenir_inspection_publique / repondre_inspection_point restent
--     exécutables par anon : c'est leur design (accès public par jeton).
--
--   À FAIRE DANS LE TABLEAU DE BORD, PAS EN SQL
--   - auth_leaked_password_protection : Authentication → Policies,
--     activer « Leaked password protection ».
-- ============================================================

alter function protect_profile_role() set search_path = public, pg_temp;
alter function set_updated_at() set search_path = public, pg_temp;
alter function est_role(variadic text[]) set search_path = public, pg_temp;
alter function handle_new_user() set search_path = public, pg_temp;
alter function maj_statut_facture() set search_path = public, pg_temp;
alter function decrementer_stock_bon() set search_path = public, pg_temp;
alter function proteger_montants_facture() set search_path = public, pg_temp;

revoke execute on function handle_new_user() from anon, authenticated;
revoke execute on function protect_profile_role() from anon, authenticated;
revoke execute on function proteger_autorisation_bon() from anon, authenticated;
revoke execute on function decrementer_stock_bon() from anon, authenticated;
revoke execute on function set_updated_at() from anon, authenticated;
revoke execute on function maj_statut_facture() from anon, authenticated;
revoke execute on function proteger_montants_facture() from anon, authenticated;
revoke execute on function fixer_garage_bon_travail_evaluations() from anon, authenticated;
revoke execute on function fixer_garage_bon_travail_lignes() from anon, authenticated;
revoke execute on function fixer_garage_facture_lignes() from anon, authenticated;
revoke execute on function fixer_numero_bon_travail() from anon, authenticated;
revoke execute on function fixer_numero_facture() from anon, authenticated;
revoke execute on function revoquer_inspections_bon() from anon, authenticated;

revoke execute on function accepter_evaluation(uuid, numeric) from anon;
revoke execute on function annuler_facture(uuid, text) from anon;
revoke execute on function creer_facture(uuid, date, boolean) from anon;
revoke execute on function enregistrer_paiement(uuid, numeric) from anon;
revoke execute on function reevaluer_bon(uuid, numeric) from anon;
revoke execute on function renoncer_evaluation(uuid) from anon;

drop policy "vehicules_stock_photos_select" on storage.objects;
create policy "vehicules_stock_photos_select" on storage.objects
  for select using (
    bucket_id = 'vehicules-stock'
    and (storage.foldername(name))[1] = garage_actuel()::text
  );
