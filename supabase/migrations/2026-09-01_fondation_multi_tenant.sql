-- ============================================================
-- Migration : 2026-09-01 — Fondation multi-locataire (étape 1/6 du plan)
--
-- Rien n'est encore rattaché à cette fondation : aucune table métier ne
-- reçoit garage_id ici, aucune policy existante n'est réécrite. C'est une
-- base isolée, testable seule, avant de toucher au reste (étapes
-- suivantes du plan d'architecture approuvé).
-- ============================================================

-- ------------------------------------------------------------
-- garages — table racine du tenant
-- ------------------------------------------------------------
create table garages (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  adresse text,
  telephone text,
  courriel text,
  neq text,
  plan_abonnement text,
  statut text not null default 'actif'
    check (statut in ('actif', 'suspendu', 'resilie')),
  -- Compteurs de numérotation BT-/FA- par garage (point 3 du plan) —
  -- verrouillés par ligne à l'écriture, jamais une séquence Postgres
  -- partagée qui mélangerait la numérotation de deux garages.
  compteur_bt int not null default 0,
  compteur_fa int not null default 0,
  cree_le timestamptz not null default now()
);

-- ------------------------------------------------------------
-- profiles.garage_id — nullable au départ (un utilisateur sans profil ou
-- sans garage assigné ne doit jamais faire planter une requête, seulement
-- renvoyer null)
-- ------------------------------------------------------------
alter table profiles add column garage_id uuid references garages(id) on delete set null;

-- ------------------------------------------------------------
-- garage_actuel() — toujours dérivée côté serveur depuis profiles, jamais
-- un claim JWT (un employé réaffecté garderait l'accès à l'ancien garage
-- tant que son token n'est pas rafraîchi — même raisonnement que
-- est_role(), qui revérifie `actif` en temps réel plutôt que via un claim
-- mis en cache).
-- ------------------------------------------------------------
create or replace function garage_actuel()
returns uuid as $$
  select garage_id from profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public, pg_temp;

alter table garages enable row level security;

-- Un utilisateur peut lire son propre garage. Aucune policy d'écriture
-- pour l'instant : la création/modification d'un garage passera par une
-- console d'administration plateforme qui n'existe pas encore (super-admin,
-- étape ultérieure du plan) — en attendant, uniquement via le SQL Editor.
create policy "garages_select_membre" on garages
  for select using (id = garage_actuel());
