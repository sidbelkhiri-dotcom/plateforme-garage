-- ============================================================
-- 1. Cloisonner admin_gere_les_profils.
--
-- La politique datait du 2026-08-13, avant le multi-garage :
--     for update using (est_role('admin')) with check (est_role('admin'))
-- Elle n'a aucun contrôle de garage. Aujourd'hui un admin du garage A ne
-- peut effectivement pas modifier le profil d'un employé du garage B —
-- une sonde du 2026-09-30 le confirme, 0 ligne modifiée — mais la
-- protection vient de la politique de LECTURE sur profiles, qui est
-- cloisonnée et rend la ligne introuvable. Celle-ci ne protège rien par
-- elle-même.
--
-- Compter sur la politique voisine est précisément ce qui a mal tourné
-- avec inspection-photos : le jour où quelqu'un relâche la lecture sur
-- profiles, un admin du garage A pourra désactiver ou promouvoir le
-- personnel du garage B — changer un rôle, ou couper un accès.
--
-- On ne touche pas au reste : protect_profile_role() garde son rôle de
-- verrou colonne par colonne (seul un admin change un rôle), et
-- profiles_update_self reste cloisonnée par auth.uid().
-- ============================================================

drop policy if exists "admin_gere_les_profils" on profiles;

create policy "admin_gere_les_profils" on profiles
  for update
  using (est_role('admin') and garage_id = garage_actuel())
  with check (est_role('admin') and garage_id = garage_actuel());

-- ============================================================
-- 2. Nommer les exceptions de auditer_cloisonnement().
--
-- Trois politiques ne mentionnent pas garage_actuel() et ne le peuvent
-- pas. Les masquer par une règle générale rendrait le contrôle inutile ;
-- on les nomme donc une par une, avec leur raison, pour qu'ajouter une
-- exception reste un geste conscient et relu.
--
--   profiles.profiles_update_self
--     using (auth.uid() = id) — un compte ne touche que sa propre ligne,
--     laquelle est par définition dans son propre garage. Cloisonné, par
--     un autre mécanisme.
--
--   demandes_accueil.demandes_accueil_insert_public
--   demandes_rendez_vous.demandes_rdv_insert_public
--     Dépôt par un visiteur anonyme, qui n'a pas de garage_actuel() : la
--     politique ne PEUT pas le mentionner. C'est une boîte aux lettres —
--     on y dépose, et la lecture reste réservée au comptoir du garage
--     par des politiques SELECT distinctes, elles cloisonnées.
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
