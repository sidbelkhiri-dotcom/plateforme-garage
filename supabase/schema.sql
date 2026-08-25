-- ============================================================
-- MECAFORCE — Schéma Supabase (PostgreSQL)
-- Voir docs/DESIGN.md §5 pour la justification de chaque choix.
-- À exécuter une seule fois, dans l'éditeur SQL d'un projet Supabase neuf.
-- Toute évolution ultérieure passe par un fichier daté dans migrations/,
-- jamais par une modification directe de ce fichier (PLAN.md, règle 5).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- updated_at — trigger générique (D20)
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- profiles — employés (D22 : trois rôles)
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null,
  role text not null default 'mecanicien'
    check (role in ('admin', 'reception', 'mecanicien')),
  actif boolean not null default true,
  created_at timestamptz not null default now()
);

-- Fonction d'aide utilisée par toutes les policies ci-dessous (security
-- definer : évite la récursion RLS d'une policy sur `profiles` qui
-- relirait `profiles`).
create or replace function est_role(variadic roles text[])
returns boolean as $$
  select coalesce(
    (select role from profiles where id = auth.uid()) = any(roles),
    false
  );
$$ language sql stable security definer;

-- Création automatique du profil à l'inscription (nom depuis les
-- métadonnées, sinon le courriel ; rôle par défaut mecanicien, à ajuster
-- ensuite par un admin).
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nom)
  values (new.id, coalesce(new.raw_user_meta_data->>'nom', new.email));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ------------------------------------------------------------
-- clients
-- ------------------------------------------------------------
create table clients (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text,
  adresse text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_clients_nom on clients (lower(nom));
create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- vehicules
-- ------------------------------------------------------------
create table vehicules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  marque text not null,
  modele text,
  annee int,
  plaque text,
  vin text,
  couleur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_vehicules_client on vehicules (client_id);
-- Index uniques partiels : pas de doublon de plaque/VIN, mais un champ
-- vide n'entre jamais en collision avec un autre champ vide.
create unique index idx_vehicules_plaque_uniq
  on vehicules (upper(plaque)) where plaque is not null and plaque <> '';
create unique index idx_vehicules_vin_uniq
  on vehicules (upper(vin)) where vin is not null and vin <> '';
create trigger vehicules_set_updated_at
  before update on vehicules
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- rendez_vous
-- ------------------------------------------------------------
create table rendez_vous (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  vehicule_id uuid references vehicules(id) on delete set null,
  employe_id uuid references profiles(id) on delete set null,
  date date not null,
  heure time not null,
  duree_min int not null default 60,
  description text not null,
  statut text not null default 'prevu'
    check (statut in ('prevu', 'confirme', 'en_cours', 'termine', 'annule', 'absent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_rdv_date on rendez_vous (date);
create index idx_rdv_employe on rendez_vous (employe_id, date);
create trigger rdv_set_updated_at
  before update on rendez_vous
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- inventaire — pièces
-- ------------------------------------------------------------
create table inventaire (
  id uuid primary key default gen_random_uuid(),
  reference text,
  nom text not null,
  quantite int not null default 0,
  seuil int not null default 3,
  prix_achat numeric(10,2) not null default 0,
  prix numeric(10,2) not null default 0,
  fournisseur text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger inventaire_set_updated_at
  before update on inventaire
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- parametres — ligne unique
-- ------------------------------------------------------------
create table parametres (
  id int primary key default 1 check (id = 1),
  nom text not null default 'MECAFORCE',
  adresse text,
  telephone text,
  courriel text,
  tps text default '713585354RT0001',
  tvq text default '1231905380TQ0001',
  taux_tps numeric(6,5) not null default 0.05000,
  taux_tvq numeric(6,5) not null default 0.09975,
  taux_horaire numeric(10,2) not null default 0,
  validite_evaluation_jours int not null default 30,
  garantie_mois int not null default 3,
  garantie_km int not null default 5000
);
insert into parametres (id) values (1);

-- ------------------------------------------------------------
-- bons_travail — le document central de la V1
-- ------------------------------------------------------------
create sequence bon_travail_numero_seq start 1;

create table bons_travail (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique
    default ('BT-' || lpad(nextval('bon_travail_numero_seq')::text, 4, '0')),
  client_id uuid references clients(id) on delete set null,
  vehicule_id uuid references vehicules(id) on delete set null,
  rendez_vous_id uuid references rendez_vous(id) on delete set null,
  employe_id uuid references profiles(id) on delete set null,
  kilometrage int not null,
  plainte_client text not null,
  diagnostic text,
  notes_internes text,
  statut text not null default 'evaluation'
    check (statut in ('evaluation', 'autorise', 'en_cours', 'termine', 'facture', 'annule')),
  -- Montants engageants : figés à l'écriture, jamais recalculés (D13).
  taux_horaire numeric(10,2) not null,
  montant_evaluation numeric(10,2),
  evaluation_acceptee_le timestamptz,
  evaluation_valide_jusqu_au date,
  renonciation_ecrite boolean not null default false,
  pieces_a_remettre boolean not null default false,
  ouvert_le date not null default current_date,
  ferme_le date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bt_statut on bons_travail (statut);
create index idx_bt_vehicule on bons_travail (vehicule_id, ouvert_le desc);
create index idx_bt_employe on bons_travail (employe_id, statut);
create trigger bt_set_updated_at
  before update on bons_travail
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- bon_travail_lignes (D16 : une seule table, discriminée par type)
-- ------------------------------------------------------------
create table bon_travail_lignes (
  id uuid primary key default gen_random_uuid(),
  bon_travail_id uuid not null references bons_travail(id) on delete cascade,
  type text not null check (type in ('piece', 'main_oeuvre')),
  description text not null,
  -- unités pour une pièce, heures pour la main-d'œuvre
  quantite numeric(10,2) not null default 1,
  -- prix pièce, ou taux horaire pour la main-d'œuvre
  prix_unitaire numeric(10,2) not null default 0,
  piece_id uuid references inventaire(id) on delete set null,
  etat_piece text check (etat_piece in ('neuve', 'usagee', 'reusinee', 'remise_a_neuf')),
  ordre int not null default 0,
  constraint etat_piece_requis check (
    (type = 'piece' and etat_piece is not null)
    or (type = 'main_oeuvre' and etat_piece is null)
  )
);
create index idx_bt_lignes_bon on bon_travail_lignes (bon_travail_id, ordre);

-- Vue des totaux — jamais stockés (D7), sauf les montants figés ci-dessus.
-- security_invoker : une vue Postgres n'hérite pas de la RLS de ses tables
-- par défaut ; sans ce réglage, la vue verrait tout, RLS ou pas.
create view bons_travail_totaux
  with (security_invoker = true) as
select
  bt.id,
  bt.numero,
  bt.statut,
  bt.montant_evaluation,
  coalesce(sum(l.quantite * l.prix_unitaire) filter (where l.type = 'piece'), 0)::numeric(10,2)
    as total_pieces,
  coalesce(sum(l.quantite * l.prix_unitaire) filter (where l.type = 'main_oeuvre'), 0)::numeric(10,2)
    as total_main_oeuvre,
  coalesce(sum(l.quantite * l.prix_unitaire), 0)::numeric(10,2) as total_ht,
  (bt.montant_evaluation is not null
    and coalesce(sum(l.quantite * l.prix_unitaire), 0) > bt.montant_evaluation) as depasse_evaluation
from bons_travail bt
left join bon_travail_lignes l on l.bon_travail_id = bt.id
group by bt.id;

-- Acceptation d'une évaluation : fige le montant et calcule la validité.
-- La RLS s'applique par ligne, pas par colonne (§5.6) — impossible
-- d'autoriser un mécanicien à modifier `diagnostic` sans lui laisser
-- `montant_evaluation`. Le verrou est donc ici : security definer, avec
-- exécution réservée à admin/reception via le GRANT plus bas (D23).
create or replace function accepter_evaluation(bon_id uuid)
returns void as $$
declare
  v_total numeric(10,2);
  v_validite_jours int;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent accepter une évaluation.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  select validite_evaluation_jours into v_validite_jours from parametres where id = 1;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_acceptee_le = now(),
      evaluation_valide_jusqu_au = current_date + v_validite_jours,
      statut = 'autorise'
  where id = bon_id;
end;
$$ language plpgsql security definer;

revoke execute on function accepter_evaluation(uuid) from public;
grant execute on function accepter_evaluation(uuid) to authenticated;

-- ------------------------------------------------------------
-- factures / facture_lignes — posées pour la V2 (D21), inutilisées en V1.
-- Structure provisoire ; sera précisée par une migration datée au
-- démarrage réel de la V2, pas retouchée ici.
-- ------------------------------------------------------------
create sequence facture_numero_seq start 1;

create table factures (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique
    default ('FA-' || lpad(nextval('facture_numero_seq')::text, 4, '0')),
  bon_travail_id uuid references bons_travail(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  vehicule_id uuid references vehicules(id) on delete set null,
  date date not null default current_date,
  statut text not null default 'impayee' check (statut in ('impayee', 'payee')),
  created_at timestamptz not null default now()
);

create table facture_lignes (
  id uuid primary key default gen_random_uuid(),
  facture_id uuid not null references factures(id) on delete cascade,
  type text not null check (type in ('piece', 'main_oeuvre')),
  description text not null,
  quantite numeric(10,2) not null default 1,
  prix_unitaire numeric(10,2) not null default 0,
  etat_piece text check (etat_piece in ('neuve', 'usagee', 'reusinee', 'remise_a_neuf')),
  ordre int not null default 0
);
create index idx_facture_lignes_facture on facture_lignes (facture_id);

-- ============================================================
-- Row Level Security (§5.6) — toute la logique d'autorisation vit ici,
-- jamais dans le code applicatif (D3).
-- ============================================================
alter table profiles enable row level security;
alter table clients enable row level security;
alter table vehicules enable row level security;
alter table rendez_vous enable row level security;
alter table inventaire enable row level security;
alter table parametres enable row level security;
alter table bons_travail enable row level security;
alter table bon_travail_lignes enable row level security;
alter table factures enable row level security;
alter table facture_lignes enable row level security;

-- profiles : lecture ouverte (nécessaire pour assigner RDV et bons),
-- écriture limitée à sa propre ligne, pas d'insert/delete (trigger/cascade).
create policy "profiles_select_all" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_self" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- La RLS s'applique par ligne, pas par colonne : la policy ci-dessus
-- autoriserait un compte à changer son propre `role` en même temps que
-- son `nom`. Le verrou est donc ici (D24, trouvé en vérifiant le Lot 1) :
-- seul un admin peut changer le rôle de quelqu'un, y compris le sien.
create or replace function protect_profile_role()
returns trigger as $$
begin
  if new.role <> old.role and not est_role('admin') then
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger protect_profile_role_trigger
  before update on profiles
  for each row execute function protect_profile_role();

-- clients
create policy "clients_select_all" on clients
  for select using (auth.role() = 'authenticated');
create policy "clients_insert_admin_reception" on clients
  for insert with check (est_role('admin', 'reception'));
create policy "clients_update_admin_reception" on clients
  for update using (est_role('admin', 'reception'));
create policy "clients_delete_admin" on clients
  for delete using (est_role('admin'));

-- vehicules
create policy "vehicules_select_all" on vehicules
  for select using (auth.role() = 'authenticated');
create policy "vehicules_insert_admin_reception" on vehicules
  for insert with check (est_role('admin', 'reception'));
create policy "vehicules_update_admin_reception" on vehicules
  for update using (est_role('admin', 'reception'));
create policy "vehicules_delete_admin" on vehicules
  for delete using (est_role('admin'));

-- rendez_vous
create policy "rdv_select_all" on rendez_vous
  for select using (auth.role() = 'authenticated');
create policy "rdv_insert_admin_reception" on rendez_vous
  for insert with check (est_role('admin', 'reception'));
create policy "rdv_update_admin_reception" on rendez_vous
  for update using (est_role('admin', 'reception'));
create policy "rdv_delete_admin" on rendez_vous
  for delete using (est_role('admin'));

-- inventaire
create policy "inventaire_select_all" on inventaire
  for select using (auth.role() = 'authenticated');
create policy "inventaire_write_admin_reception" on inventaire
  for all using (est_role('admin', 'reception')) with check (est_role('admin', 'reception'));

-- parametres
create policy "parametres_select_all" on parametres
  for select using (auth.role() = 'authenticated');
create policy "parametres_update_admin" on parametres
  for update using (est_role('admin'));

-- bons_travail : select ouvert ; insert admin/reception ; update
-- admin/reception + le mécanicien assigné ; delete admin seulement.
create policy "bt_select_all" on bons_travail
  for select using (auth.role() = 'authenticated');
create policy "bt_insert_admin_reception" on bons_travail
  for insert with check (est_role('admin', 'reception'));
create policy "bt_update_admin_reception_ou_assigne" on bons_travail
  for update using (
    est_role('admin', 'reception') or employe_id = auth.uid()
  );
create policy "bt_delete_admin" on bons_travail
  for delete using (est_role('admin'));

-- bon_travail_lignes : select ouvert ; écriture pour admin/reception et le
-- mécanicien assigné au bon parent.
create policy "bt_lignes_select_all" on bon_travail_lignes
  for select using (auth.role() = 'authenticated');
create policy "bt_lignes_write_autorise" on bon_travail_lignes
  for all using (
    exists (
      select 1 from bons_travail bt
      where bt.id = bon_travail_id
        and (est_role('admin', 'reception') or bt.employe_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from bons_travail bt
      where bt.id = bon_travail_id
        and (est_role('admin', 'reception') or bt.employe_id = auth.uid())
    )
  );

-- factures / facture_lignes (V2, posées mais inutilisées)
create policy "factures_select_all" on factures
  for select using (auth.role() = 'authenticated');
create policy "factures_write_admin_reception" on factures
  for all using (est_role('admin', 'reception')) with check (est_role('admin', 'reception'));
create policy "facture_lignes_select_all" on facture_lignes
  for select using (auth.role() = 'authenticated');
create policy "facture_lignes_write_admin_reception" on facture_lignes
  for all using (est_role('admin', 'reception')) with check (est_role('admin', 'reception'));
