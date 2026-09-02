-- ============================================================
-- Migration : 2026-09-13 — fermer l'accès anon sur accepter_evaluation
-- et enregistrer_paiement (suite du durcissement Security Advisor)
--
-- Contrairement à creer_facture/annuler_facture/reevaluer_bon, ces deux
-- fonctions n'avaient jamais eu de `revoke ... from public` dans leur
-- migration d'origine — le droit PUBLIC par défaut de Postgres restait
-- donc en place, et anon en héritait, malgré la révocation nommée sur
-- anon de la migration précédente (qui ne touche pas PUBLIC).
--
-- Le grant explicite à authenticated est nécessaire ici : sans lui,
-- authenticated perdrait aussi l'accès (il ne l'avait que par héritage
-- de PUBLIC, jamais par un grant direct).
-- ============================================================

revoke execute on function accepter_evaluation(uuid, numeric) from public;
grant execute on function accepter_evaluation(uuid, numeric) to authenticated;

revoke execute on function enregistrer_paiement(uuid, numeric) from public;
grant execute on function enregistrer_paiement(uuid, numeric) to authenticated;
