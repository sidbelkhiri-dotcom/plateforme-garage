-- ============================================================
-- Migration : 2026-08-13 — borne d'enregistrement client (QR code)
-- Table d'attente publique : le client remplit ses renseignements à
-- son arrivée, la réception valide avant que ça devienne un vrai
-- client/véhicule/bon de travail. Rien n'est jamais écrit directement
-- dans les tables opérationnelles depuis cette page publique.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create table demandes_accueil (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  nom text not null,
  telephone text,
  courriel text,
  marque text,
  modele text,
  annee int,
  plaque text,
  plainte text,
  statut text not null default 'nouvelle'
    check (statut in ('nouvelle', 'traitee', 'ignoree'))
);
create index idx_demandes_accueil_statut on demandes_accueil (statut, created_at);

alter table demandes_accueil enable row level security;

-- Écriture ouverte à tous (page publique, sans connexion) : c'est
-- volontaire, le pire cas est une ligne à ignorer, jamais une
-- corruption des vraies données (voir note ci-dessus).
create policy "demandes_accueil_insert_public" on demandes_accueil
  for insert with check (true);

-- Lecture/traitement réservés au personnel du comptoir.
create policy "demandes_accueil_select_staff" on demandes_accueil
  for select using (est_role('admin', 'reception'));
create policy "demandes_accueil_update_staff" on demandes_accueil
  for update using (est_role('admin', 'reception'));
create policy "demandes_accueil_delete_staff" on demandes_accueil
  for delete using (est_role('admin', 'reception'));
