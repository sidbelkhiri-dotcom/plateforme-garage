-- ============================================================
-- Migration : 2026-09-02 — garage_id sur les tables métier (étape 2/6)
--
-- Un seul tenant pilote pour l'instant (celui créé ici), pour valider que
-- rien ne casse avant d'introduire un deuxième garage de test (étape 5).
--
-- Volontairement HORS de cette migration (voir plan d'architecture) :
--   - la réécriture des 14 policies SELECT non scopées (étape 3)
--   - les FK composites garage_id (étape suivante, sur cette même base
--     à un seul tenant, donc sans risque de rupture de données)
--   - la numérotation BT-/FA- par garage (compteur déjà posé sur
--     `garages` à l'étape 1, câblage applicatif à faire séparément)
--   - ref_vehicule_ymm et ref_pieces restent des catalogues partagés,
--     jamais scopés par garage
--   - demandes_accueil / demandes_rendez_vous / inspections : formulaires
--     publics et fonctionnalité distincte, explicitement Phase 2+ du plan
-- ============================================================

insert into garages (nom) values ('Atelier pilote (développement)');

-- ------------------------------------------------------------
-- Tables racines
-- ------------------------------------------------------------
alter table clients add column garage_id uuid references garages(id);
update clients set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table clients alter column garage_id set not null;

alter table vehicules add column garage_id uuid references garages(id);
update vehicules set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table vehicules alter column garage_id set not null;

alter table rendez_vous add column garage_id uuid references garages(id);
update rendez_vous set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table rendez_vous alter column garage_id set not null;

alter table inventaire add column garage_id uuid references garages(id);
update inventaire set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table inventaire alter column garage_id set not null;

alter table bons_travail add column garage_id uuid references garages(id);
update bons_travail set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table bons_travail alter column garage_id set not null;

alter table factures add column garage_id uuid references garages(id);
update factures set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table factures alter column garage_id set not null;

alter table vehicules_stock add column garage_id uuid references garages(id);
update vehicules_stock set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table vehicules_stock alter column garage_id set not null;

-- ------------------------------------------------------------
-- Tables filles : garage_id dénormalisé, jamais saisi par l'application —
-- toujours dérivé du parent par trigger, et immuable une fois posé (point
-- 2 du plan). Nécessaire pour des policies en égalité simple indexable
-- plutôt qu'un EXISTS corrélé par ligne, et pour les FK composites à venir.
-- ------------------------------------------------------------
alter table bon_travail_lignes add column garage_id uuid references garages(id);
update bon_travail_lignes l set garage_id = b.garage_id from bons_travail b where b.id = l.bon_travail_id;
alter table bon_travail_lignes alter column garage_id set not null;

alter table bon_travail_evaluations add column garage_id uuid references garages(id);
update bon_travail_evaluations e set garage_id = b.garage_id from bons_travail b where b.id = e.bon_travail_id;
alter table bon_travail_evaluations alter column garage_id set not null;

alter table facture_lignes add column garage_id uuid references garages(id);
update facture_lignes l set garage_id = f.garage_id from factures f where f.id = l.facture_id;
alter table facture_lignes alter column garage_id set not null;

create or replace function fixer_garage_bon_travail_lignes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    select garage_id into new.garage_id from bons_travail where id = new.bon_travail_id;
  elsif new.garage_id is distinct from old.garage_id then
    raise exception 'garage_id est immuable sur bon_travail_lignes.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger bon_travail_lignes_fixer_garage
  before insert or update on bon_travail_lignes
  for each row execute function fixer_garage_bon_travail_lignes();

create or replace function fixer_garage_bon_travail_evaluations()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    select garage_id into new.garage_id from bons_travail where id = new.bon_travail_id;
  elsif new.garage_id is distinct from old.garage_id then
    raise exception 'garage_id est immuable sur bon_travail_evaluations.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger bon_travail_evaluations_fixer_garage
  before insert or update on bon_travail_evaluations
  for each row execute function fixer_garage_bon_travail_evaluations();

create or replace function fixer_garage_facture_lignes()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    select garage_id into new.garage_id from factures where id = new.facture_id;
  elsif new.garage_id is distinct from old.garage_id then
    raise exception 'garage_id est immuable sur facture_lignes.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger facture_lignes_fixer_garage
  before insert or update on facture_lignes
  for each row execute function fixer_garage_facture_lignes();

-- ------------------------------------------------------------
-- Repartitionnement des index uniques globaux (point 4 du plan) : sans
-- ça, le deuxième garage à enregistrer une plaque déjà vue ailleurs dans
-- la base reçoit une erreur, et ça fuit accessoirement l'information
-- qu'un autre garage a ce véhicule.
-- ------------------------------------------------------------
drop index idx_vehicules_plaque_uniq;
drop index idx_vehicules_vin_uniq;
create unique index idx_vehicules_plaque_uniq
  on vehicules (garage_id, upper(plaque)) where plaque is not null and plaque <> '';
create unique index idx_vehicules_vin_uniq
  on vehicules (garage_id, upper(vin)) where vin is not null and vin <> '';
