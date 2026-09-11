-- ============================================================
-- Inventorier les fonctions exécutables sans compte.
--
-- Le plan réclamait ce contrôle pour l'inspection numérique :
--   « select proname from pg_proc where has_function_privilege('anon',
--     oid, 'execute') → exactement les deux fonctions attendues, rien
--     d'hérité d'un grant public oublié »
--
-- Il n'était pas automatisé, et c'est le genre de chose qui se dégrade
-- sans bruit : Supabase accorde EXECUTE à anon/authenticated sur TOUTE
-- nouvelle fonction du schéma public. Chaque fonction ajoutée sans
-- revoke explicite devient donc joignable par n'importe qui, sans que
-- rien ne le signale. L'oubli s'est déjà produit deux fois dans ce
-- projet (reevaluer_bon le 2026-08-25, puis le lot du 2026-09-11).
--
-- La fonction ne juge pas : elle énumère. C'est la suite d'isolation qui
-- compare l'inventaire à la liste attendue, pour que l'ajout d'une porte
-- publique reste un geste conscient, écrit dans le dépôt et relu.
-- ============================================================

create or replace function fonctions_publiques()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(nom order by nom), '[]'::jsonb)
  from (
    select distinct p.proname as nom
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_catalog.has_function_privilege('anon', p.oid, 'execute')
  ) t;
$$;

revoke all on function fonctions_publiques() from public;
revoke all on function fonctions_publiques() from anon, authenticated;
grant execute on function fonctions_publiques() to service_role;

notify pgrst, 'reload schema';
