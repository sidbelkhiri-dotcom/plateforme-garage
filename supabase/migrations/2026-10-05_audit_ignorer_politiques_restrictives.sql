-- ============================================================
-- L'audit ne doit contrôler que les politiques PERMISSIVES.
--
-- Le 2026-09-11, le gel d'écriture a posé 45 politiques RESTRICTIVE
-- portant garage_operationnel(). auditer_cloisonnement() les a toutes
-- signalées comme « ignorant garage_actuel() » : son contrôle est une
-- recherche de texte, et il ne voit pas que garage_operationnel() appelle
-- garage_actuel() à l'intérieur.
--
-- Ajouter garage_operationnel à la liste des noms acceptés aurait fait
-- taire le symptôme. Le vrai correctif est plus net : une politique
-- RESTRICTIVE ne peut, par construction, que retrancher de l'accès — elle
-- s'ajoute en ET aux permissives et n'accorde jamais rien. Elle ne peut
-- donc pas être le trou que ce contrôle cherche. Le contrôle vise les
-- politiques qui ACCORDENT un accès sans le cloisonner ; ce sont les
-- permissives, et elles seules.
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
      where pp.permissive = 'PERMISSIVE'
        and (
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
        and pp.policyname not in (
              'profiles_update_self',
              'demandes_accueil_insert_public',
              'demandes_rdv_insert_public'
            )
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

notify pgrst, 'reload schema';
