-- ============================================================
-- auditer_cloisonnement() — le pendant de npm run isolation.
--
-- La suite d'isolation vérifie que les cloisons tiennent. Elle ne peut
-- pas voir une table arrivée SANS cloison du tout : elle ne sonde que ce
-- qu'on lui a semé. Cette fonction regarde le catalogue et répond à la
-- question inverse — qu'est-ce qui, dans le schéma, n'est pas protégé ?
--
-- Elle reprend les contrôles du Database Linter de Supabase
-- (rls_disabled_in_public, security_definer_view,
-- function_search_path_mutable), qui ne s'appelle que depuis le tableau
-- de bord et ne peut donc pas entrer dans un test automatisé.
--
-- Elle y ajoute un contrôle que le linter ne peut pas faire, parce qu'il
-- est propre à ce projet : toute politique posée sur une table portant
-- garage_id, ou sur storage.objects, qui ne mentionne jamais
-- garage_actuel() ni est_admin_plateforme(). C'est la forme exacte du
-- bug corrigé le 2026-09-29 sur inspection-photos — une politique écrite
-- à la main qui oublie le cloisonnement pendant que ses voisines l'ont.
--
-- security definer parce que pg_policy et pg_proc ne sont pas lisibles
-- par un rôle applicatif ; l'exécution est donc retirée à tout le monde
-- et rendue au seul service_role, qui est déjà la clé du test.
-- ============================================================

create or replace function auditer_cloisonnement()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'rls_desactivee', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    ),
    'rls_sans_politique', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
        and not exists (select 1 from pg_catalog.pg_policy p where p.polrelid = c.oid)
    ),
    'politiques_non_cloisonnees', (
      select coalesce(jsonb_agg(
               jsonb_build_object('table', pp.schemaname || '.' || pp.tablename,
                                  'politique', pp.policyname,
                                  'commande', pp.cmd)
               order by pp.tablename, pp.policyname), '[]'::jsonb)
      from pg_catalog.pg_policies pp
      where (
              (pp.schemaname = 'public' and exists (
                 select 1 from information_schema.columns col
                 where col.table_schema = 'public'
                   and col.table_name = pp.tablename
                   and col.column_name = 'garage_id'))
              or (pp.schemaname = 'storage' and pp.tablename = 'objects')
            )
        and coalesce(pp.qual, '') || ' ' || coalesce(pp.with_check, '')
              not like '%garage_actuel%'
        and coalesce(pp.qual, '') || ' ' || coalesce(pp.with_check, '')
              not like '%est_admin_plateforme%'
    ),
    'fonctions_search_path_mutable', (
      select coalesce(jsonb_agg(p.proname order by p.proname), '[]'::jsonb)
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (
          select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
          where cfg like 'search_path=%')
    ),
    'vues_security_definer', (
      select coalesce(jsonb_agg(c.relname order by c.relname), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'v'
        and coalesce(c.reloptions::text, '') like '%security_definer%'
    )
  );
$$;

revoke all on function auditer_cloisonnement() from public;
revoke all on function auditer_cloisonnement() from anon, authenticated;
grant execute on function auditer_cloisonnement() to service_role;
