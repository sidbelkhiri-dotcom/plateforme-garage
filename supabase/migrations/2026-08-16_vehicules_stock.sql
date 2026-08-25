-- ============================================================
-- Migration : 2026-08-16 — inventaire de véhicules à vendre
-- Distinct de `vehicules` (toujours lié à un client qui l'apporte pour
-- réparation) : un véhicule de `vehicules_stock` appartient au garage,
-- avant vente. Suivi simple demandé — pas de facture générée
-- (contrairement aux réparations, D13/D21) : juste le prix de vente réel,
-- l'acheteur et la date, pour calculer la marge par rapport au coût
-- d'achat à l'affichage (jamais stockée, même principe D7).
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create table vehicules_stock (
  id uuid primary key default gen_random_uuid(),
  marque text not null,
  modele text not null,
  annee int,
  vin text,
  plaque text,
  couleur text,
  kilometrage int,
  cout_achat numeric(10,2) not null default 0,
  prix_demande numeric(10,2) not null default 0,
  statut text not null default 'disponible'
    check (statut in ('disponible', 'reserve', 'vendu')),
  notes text,
  vendu_le date,
  prix_vente numeric(10,2),
  acheteur_nom text,
  acheteur_telephone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_vehicules_stock_statut on vehicules_stock (statut);
create trigger vehicules_stock_set_updated_at
  before update on vehicules_stock
  for each row execute function set_updated_at();

alter table vehicules_stock enable row level security;

-- Même politique que inventaire (pièces) : lecture pour tout le
-- personnel, écriture réservée à admin/reception — un mécanicien ne gère
-- ni les prix ni les ventes.
create policy "vehicules_stock_select_all" on vehicules_stock
  for select using (auth.role() = 'authenticated');
create policy "vehicules_stock_write_admin_reception" on vehicules_stock
  for all using (est_role('admin', 'reception')) with check (est_role('admin', 'reception'));
