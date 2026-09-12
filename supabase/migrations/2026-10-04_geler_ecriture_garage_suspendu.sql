-- ============================================================
-- Geler l'écriture d'un garage suspendu, sans toucher à sa lecture.
--
-- Le problème mesuré le 2026-09-11 : la suspension n'existait que dans
-- middleware.ts. Un employé d'un garage suspendu, dont l'abonnement a
-- échoué ou même dont le garage est résilié, continuait de lire ET
-- d'écrire normalement en appelant l'API Supabase directement avec le
-- jeton que son propre navigateur détient. Les quatre écritures de la
-- sonde sont passées, dans les quatre états.
--
-- Ce n'était pas une fuite entre garages — un garage suspendu ne voyait
-- que ses données — mais un écart entre le levier commercial annoncé et
-- ce qui était réellement appliqué. Le middleware protège une porte ;
-- l'API en est une autre, grande ouverte à côté.
--
-- POURQUOI LA LECTURE RESTE OUVERTE
-- Un garage suspendu ne peut plus travailler, mais il doit continuer de
-- voir ses données et pouvoir les exporter. Ses factures sont des pièces
-- comptables qu'il a l'obligation de conserver et de pouvoir produire :
-- les lui cacher parce qu'une carte de crédit a expiré serait
-- disproportionné, et le plan signalait déjà le risque contractuel de
-- couper l'accès d'un garage à ses propres données. Couper l'écriture
-- suffit : sans écriture, on n'exploite pas un atelier.
--
-- CE QUI N'EST PAS GELÉ, ET POURQUOI
--   demandes_accueil, demandes_rendez_vous
--     Ce sont des files d'attente où un visiteur ANONYME dépose. Un
--     anonyme n'a pas de garage_actuel() : une règle fondée dessus
--     bloquerait la prise de rendez-vous de TOUS les garages, pas
--     seulement des suspendus. Et un garage suspendu qui accumule des
--     demandes qu'il ne peut pas traiter ne nuit à personne.
--   garages
--     C'est la table que le webhook Stripe et le super-admin doivent
--     pouvoir écrire précisément quand le garage est bloqué — c'est par
--     là que passe le déblocage.
--
-- L'admin de plateforme est exempté, comme il l'est déjà dans
-- middleware.ts : il doit pouvoir intervenir sur un garage bloqué.
-- Le service_role contourne la RLS par nature, donc les tâches
-- planifiées et les webhooks ne sont pas concernés.
--
-- La liste des statuts d'abonnement bloquants est recopiée telle quelle
-- depuis middleware.ts. Deux barrières qui ne s'accordent pas seraient
-- pires qu'une seule : si l'une change, l'autre doit changer avec.
-- ============================================================

create or replace function garage_operationnel()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select est_admin_plateforme() or coalesce((
    select g.statut = 'actif'
       and (g.abonnement_statut is null
            or g.abonnement_statut not in ('past_due', 'canceled', 'unpaid', 'incomplete_expired'))
    from garages g
    where g.id = garage_actuel()
  ), false);
$$;

revoke all on function garage_operationnel() from public;
-- anon et authenticated doivent pouvoir l'exécuter : elle est appelée
-- par des politiques RLS, lesquelles s'évaluent avec les privilèges de
-- l'appelant. Sans ce grant, toute écriture lèverait « permission
-- denied » au lieu d'être simplement refusée.
grant execute on function garage_operationnel() to anon, authenticated, service_role;

-- Des politiques RESTRICTIVE : elles s'ajoutent en ET à celles qui
-- existent, sans qu'aucune ait à être réécrite. Une politique permissive
-- de plus aurait élargi l'accès au lieu de le restreindre.
do $$
declare
  t text;
  tables text[] := array[
    'clients', 'vehicules', 'bons_travail', 'bon_travail_lignes',
    'bon_travail_evaluations', 'inspections', 'inspection_points',
    'inspection_photos', 'factures', 'facture_lignes', 'rendez_vous',
    'inventaire', 'vehicules_stock', 'parametres', 'profiles'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists "gel_insert_garage_suspendu" on %I', t);
    execute format('drop policy if exists "gel_update_garage_suspendu" on %I', t);
    execute format('drop policy if exists "gel_delete_garage_suspendu" on %I', t);

    execute format(
      'create policy "gel_insert_garage_suspendu" on %I as restrictive for insert with check (garage_operationnel())', t);
    execute format(
      'create policy "gel_update_garage_suspendu" on %I as restrictive for update using (garage_operationnel())', t);
    execute format(
      'create policy "gel_delete_garage_suspendu" on %I as restrictive for delete using (garage_operationnel())', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
