-- ============================================================
-- Migration : 2026-09-20 — inspection numérique : rattrapage multi-tenant
--
-- 2026-08-25_inspection_numerique.sql a été écrit et exécuté AVANT la
-- conversion multi-tenant (2026-09-01 et suivantes) — les 3 tables
-- n'ont jamais reçu garage_id, et leur seule policy
-- ("_staff_all", using est_role(...) sans scope) laisserait aujourd'hui
-- n'importe quel employé de n'importe quel garage voir/modifier les
-- inspections de tous les autres garages. Aucune donnée n'existe encore
-- dans ces 3 tables (vérifié avant d'écrire cette migration) — pas de
-- backfill nécessaire, juste ajouter la colonne et la verrouiller.
--
-- obtenir_inspection_publique()/repondre_inspection_point() n'ont pas
-- besoin d'être touchées : elles résolvent uniquement par jeton_acces
-- (unique sur toute la base, indépendant du tenant), jamais par
-- garage_actuel() — un visiteur anonyme n'a pas de garage courant.
-- ============================================================

-- ------------------------------------------------------------
-- inspections — table racine de la fonctionnalité (référence bons_travail)
-- ------------------------------------------------------------

alter table inspections drop constraint inspections_bon_travail_id_fkey;
alter table inspections add column garage_id uuid not null default garage_actuel() references garages(id);
alter table inspections add constraint inspections_id_garage_uniq unique (id, garage_id);
alter table inspections add constraint inspections_bon_travail_garage_fkey
  foreign key (bon_travail_id, garage_id) references bons_travail (id, garage_id) on delete cascade;

drop policy "inspections_staff_all" on inspections;
create policy "inspections_staff_all" on inspections
  for all using (est_role('admin', 'reception', 'mecanicien') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception', 'mecanicien') and garage_id = garage_actuel());

-- ------------------------------------------------------------
-- inspection_points — dénormalisé depuis inspections, comme
-- bon_travail_lignes depuis bons_travail (même trigger, même immutabilité)
-- ------------------------------------------------------------

alter table inspection_points drop constraint inspection_points_inspection_id_fkey;
alter table inspection_points add column garage_id uuid not null references garages(id);
alter table inspection_points add constraint inspection_points_id_garage_uniq unique (id, garage_id);
alter table inspection_points add constraint inspection_points_inspection_garage_fkey
  foreign key (inspection_id, garage_id) references inspections (id, garage_id) on delete cascade;

create or replace function fixer_garage_inspection_points()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    select garage_id into new.garage_id from inspections where id = new.inspection_id;
  elsif new.garage_id is distinct from old.garage_id then
    raise exception 'garage_id est immuable sur inspection_points.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger inspection_points_fixer_garage
  before insert or update on inspection_points
  for each row execute function fixer_garage_inspection_points();

drop policy "inspection_points_staff_all" on inspection_points;
create policy "inspection_points_staff_all" on inspection_points
  for all using (est_role('admin', 'reception', 'mecanicien') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception', 'mecanicien') and garage_id = garage_actuel());

-- ------------------------------------------------------------
-- inspection_photos — dénormalisé depuis inspection_points
-- ------------------------------------------------------------

alter table inspection_photos drop constraint inspection_photos_inspection_point_id_fkey;
alter table inspection_photos add column garage_id uuid not null references garages(id);
alter table inspection_photos add constraint inspection_photos_id_garage_uniq unique (id, garage_id);
alter table inspection_photos add constraint inspection_photos_point_garage_fkey
  foreign key (inspection_point_id, garage_id) references inspection_points (id, garage_id) on delete cascade;

-- Chemin du fichier dans le bucket Storage (préfixé garage_id/... à
-- l'upload, voir composants formulaires) — colonne oubliée dans le
-- brouillon d'origine, sans elle impossible de reconstruire l'URL.
alter table inspection_photos add column chemin text not null default '';
alter table inspection_photos alter column chemin drop default;

create or replace function fixer_garage_inspection_photos()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    select garage_id into new.garage_id from inspection_points where id = new.inspection_point_id;
  elsif new.garage_id is distinct from old.garage_id then
    raise exception 'garage_id est immuable sur inspection_photos.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger inspection_photos_fixer_garage
  before insert or update on inspection_photos
  for each row execute function fixer_garage_inspection_photos();

drop policy "inspection_photos_staff_all" on inspection_photos;
create policy "inspection_photos_staff_all" on inspection_photos
  for all using (est_role('admin', 'reception', 'mecanicien') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception', 'mecanicien') and garage_id = garage_actuel());

-- ------------------------------------------------------------
-- Storage — jamais créé dans le brouillon d'origine. Bucket public en
-- lecture (compromis MVP assumé, voir docs/AUDIT.md) : ce sont des
-- photos d'état de véhicule, pas de données financières ; le chemin
-- utilise garage_id (écriture) — jamais le jeton d'accès de
-- l'inspection, pour ne pas corréler une fuite de photo au lien complet.
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', true)
on conflict (id) do nothing;

create policy "inspection_photos_storage_select" on storage.objects
  for select using (bucket_id = 'inspection-photos');
create policy "inspection_photos_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'inspection-photos'
    and est_role('admin', 'reception', 'mecanicien')
    and (storage.foldername(name))[1] = garage_actuel()::text
  );
create policy "inspection_photos_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'inspection-photos'
    and est_role('admin', 'reception', 'mecanicien')
    and (storage.foldername(name))[1] = garage_actuel()::text
  );
