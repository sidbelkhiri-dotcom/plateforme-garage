-- ============================================================
-- Révoquer les fonctions de déclencheur laissées ouvertes.
--
-- Supabase accorde EXECUTE à anon/authenticated sur TOUTE nouvelle
-- fonction du schéma public. La migration du 2026-09-11 avait été écrite
-- exactement pour ça et en avait révoqué dix-neuf.
--
-- L'omission est revenue deux fois depuis, dans des migrations qui ne
-- pensaient pas au problème :
--   2026-09-20 : fixer_garage_inspection_points, fixer_garage_inspection_photos
--   2026-09-26 : generer_slug_garage
-- (la même migration du 26 a pourtant correctement traité
-- obtenir_garage_public — la vigilance était là, appliquée à la fonction
-- publique et pas au déclencheur.)
--
-- Aucune n'est joignable par l'API aujourd'hui : PostgREST n'expose pas
-- les fonctions qui renvoient `trigger`. Mais ce refus-là vient de
-- PostgREST, pas d'une décision de ce projet — ce n'est pas une frontière
-- qu'on a choisie, donc pas une sur laquelle s'appuyer.
--
-- Ne SONT PAS révoquées, et c'est délibéré :
--   est_role, est_admin_plateforme, garage_actuel
-- Elles sont appelées par les politiques RLS, et une politique s'évalue
-- avec les privilèges de l'appelant. Les révoquer ferait échouer en
-- « permission denied » toute requête anonyme touchant une table dont la
-- politique les invoque — dont la borne d'accueil publique et la prise de
-- rendez-vous. Leur exposition est nulle : elles ne renseignent que sur
-- l'appelant, et pour un anonyme elles renvoient null et false (vérifié
-- le 2026-09-11).
-- ============================================================

-- `public` d'abord, et ce n'est pas décoratif. PostgreSQL accorde
-- EXECUTE au pseudo-rôle PUBLIC sur chaque nouvelle fonction, et
-- has_function_privilege('anon', …) répond « oui » dès qu'anon a le
-- droit par n'importe quel chemin. Une révocation qui ne vise qu'anon
-- et authenticated peut donc réussir, ne rien signaler, et ne rien
-- changer. C'est la forme la plus désagréable d'échec : silencieuse.
--
-- Honnêteté sur le diagnostic : les premières tentatives, sans `public`,
-- n'ont produit aucun effet, et l'ajout de `public` a fonctionné. Mais
-- je n'ai pas la preuve que ces tentatives avaient bien été exécutées —
-- je n'ai vu le résultat qu'au dernier essai. Le lien de cause à effet
-- est donc plausible, pas démontré. Ce qui est sûr : inclure `public`
-- est correct dans tous les cas, et ne rien coûter quand c'est inutile.
revoke execute on function fixer_garage_inspection_points() from public, anon, authenticated;
revoke execute on function fixer_garage_inspection_photos() from public, anon, authenticated;
revoke execute on function generer_slug_garage() from public, anon, authenticated;

notify pgrst, 'reload schema';

select coalesce(jsonb_agg(p.proname::text order by p.proname), '[]'::jsonb) as appelables_sans_compte
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_catalog.has_function_privilege('anon', p.oid, 'execute');
