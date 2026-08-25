-- ============================================================
-- Migration : 2026-08-23 — demandes de rendez-vous depuis le site web
-- Même principe que demandes_accueil (borne QR au comptoir) : le
-- formulaire public écrit dans une table d'attente, jamais dans les
-- vraies données. La réception valide chaque demande, ce qui crée
-- alors le vrai rendez-vous — et le client s'il n'existe pas déjà.
--
-- Table distincte de demandes_accueil plutôt qu'une colonne `source` :
-- une demande de rendez-vous porte des champs que l'accueil n'a pas
-- (date souhaitée, plage horaire, service demandé), et l'accueil porte
-- des champs qu'un rendez-vous n'a pas (plainte constatée sur place).
--
-- Différence de sécurité importante avec la borne : ce formulaire est
-- exposé à Internet, pas protégé par le fait d'être physiquement dans
-- le garage. Le pire cas reste identique — du bruit dans une liste
-- d'attente, jamais un faux client dans les vraies données.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create table demandes_rendez_vous (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Contact
  nom text not null,
  telephone text,
  courriel text,

  -- Véhicule (facultatif : le client ne le connaît pas toujours)
  marque text,
  modele text,
  annee int,

  -- Demande
  service text,
  date_souhaitee date,
  plage text check (plage in ('matin', 'apres_midi', 'flexible')),
  message text,

  statut text not null default 'nouvelle'
    check (statut in ('nouvelle', 'traitee', 'ignoree'))
);
create index idx_demandes_rdv_statut on demandes_rendez_vous (statut, created_at);

alter table demandes_rendez_vous enable row level security;

-- Écriture ouverte à tous : le formulaire public n'a pas de session.
create policy "demandes_rdv_insert_public" on demandes_rendez_vous
  for insert with check (true);

-- Lecture et traitement réservés au comptoir, comme demandes_accueil.
create policy "demandes_rdv_select_staff" on demandes_rendez_vous
  for select using (est_role('admin', 'reception'));
create policy "demandes_rdv_update_staff" on demandes_rendez_vous
  for update using (est_role('admin', 'reception'));
create policy "demandes_rdv_delete_staff" on demandes_rendez_vous
  for delete using (est_role('admin', 'reception'));

-- Diffusion temps réel, pour le badge et l'alerte dans la barre
-- latérale. La RLS ci-dessus s'applique aussi aux événements diffusés :
-- un mécanicien ne recevra rien.
alter publication supabase_realtime add table demandes_rendez_vous;
