-- ============================================================
-- Migration : 2026-08-13 — table de référence Année/Marque/Modèle
-- Alimente le menu déroulant + suggestions du formulaire véhicule.
-- Données moissonnées depuis l'API NHTSA vPIC (voir garage-data/).
-- À exécuter une fois dans le SQL Editor du projet existant, PUIS
-- importer garage-data/ref_vehicule_ymm.csv dans la table via
-- Table Editor > ref_vehicule_ymm > Insert > Import data from CSV.
-- ============================================================

create table ref_vehicule_ymm (
  id bigint generated always as identity primary key,
  marque text not null,
  modele text not null,
  annee int not null,
  source text not null default 'vpic',
  unique (marque, modele, annee)
);
create index idx_ref_vehicule_ymm_marque on ref_vehicule_ymm (marque);

alter table ref_vehicule_ymm enable row level security;

-- Lecture seule pour l'application ; le chargement se fait par import
-- CSV/SQL direct (aucune policy d'écriture, donc l'API bloque toute
-- modification depuis le client).
create policy "ref_vehicule_ymm_select_all" on ref_vehicule_ymm
  for select using (auth.role() = 'authenticated');

-- Liste des marques distinctes, pour le premier menu déroulant sans
-- avoir à transférer les ~24 000 lignes côté client.
create view ref_marques
  with (security_invoker = true) as
select distinct marque from ref_vehicule_ymm order by marque;
