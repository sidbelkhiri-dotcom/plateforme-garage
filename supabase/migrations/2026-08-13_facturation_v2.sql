-- ============================================================
-- Migration : 2026-08-13 — démarrage réel de la V2 (facturation)
-- Précise la structure provisoire de factures/facture_lignes posée au
-- Lot 1 (D21) : montants figés (D13), taxes, garantie, paiements
-- partiels. Voir DESIGN.md journal de décisions.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table factures
  add column total_pieces numeric(10,2) not null default 0,
  add column total_main_oeuvre numeric(10,2) not null default 0,
  add column total_ht numeric(10,2) not null default 0,
  add column taux_tps numeric(6,5) not null default 0,
  add column taux_tvq numeric(6,5) not null default 0,
  add column montant_tps numeric(10,2) not null default 0,
  add column montant_tvq numeric(10,2) not null default 0,
  add column total_ttc numeric(10,2) not null default 0,
  add column kilometrage int,
  add column garantie_mois int not null default 3,
  add column garantie_km int not null default 5000,
  add column montant_paye numeric(10,2) not null default 0;

-- Un seul bon de travail facturé une fois : creer_facture() vérifie déjà
-- le statut, cet index protège contre une course entre deux requêtes.
create unique index idx_factures_bon_travail_uniq on factures (bon_travail_id)
  where bon_travail_id is not null;

alter table factures drop constraint factures_statut_check;
alter table factures add constraint factures_statut_check
  check (statut in ('impayee', 'partielle', 'payee'));

-- Le statut se déduit toujours du montant payé — jamais réglé à la main,
-- pour qu'il ne puisse pas diverger de la réalité comptable.
create or replace function maj_statut_facture()
returns trigger as $$
begin
  if new.total_ttc > 0 and new.montant_paye >= new.total_ttc then
    new.statut := 'payee';
  elsif new.montant_paye > 0 then
    new.statut := 'partielle';
  else
    new.statut := 'impayee';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger factures_maj_statut_trigger
  before insert or update on factures
  for each row execute function maj_statut_facture();

-- D31 : même principe que D24/D25 — la RLS autorise admin/reception à
-- écrire toute la ligne, mais une facture émise est un document légal :
-- ses montants ne doivent plus bouger une fois créés, seul le paiement
-- encaissé peut évoluer.
create or replace function proteger_montants_facture()
returns trigger as $$
begin
  if (
    new.total_pieces is distinct from old.total_pieces
    or new.total_main_oeuvre is distinct from old.total_main_oeuvre
    or new.total_ht is distinct from old.total_ht
    or new.taux_tps is distinct from old.taux_tps
    or new.taux_tvq is distinct from old.taux_tvq
    or new.montant_tps is distinct from old.montant_tps
    or new.montant_tvq is distinct from old.montant_tvq
    or new.total_ttc is distinct from old.total_ttc
    or new.kilometrage is distinct from old.kilometrage
    or new.garantie_mois is distinct from old.garantie_mois
    or new.garantie_km is distinct from old.garantie_km
    or new.bon_travail_id is distinct from old.bon_travail_id
    or new.client_id is distinct from old.client_id
    or new.vehicule_id is distinct from old.vehicule_id
    or new.date is distinct from old.date
  ) then
    raise exception 'Les montants et l''identification d''une facture émise ne peuvent pas être modifiés — seul le paiement encaissé (montant_paye) peut évoluer.';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger factures_proteger_montants_trigger
  before update on factures
  for each row execute function proteger_montants_facture();

-- Génère la facture depuis un bon de travail terminé : montants et taxes
-- figés au moment de l'émission (D13), jamais recalculés ensuite même si
-- les taux ou le taux horaire changent plus tard dans les paramètres.
-- p_date fourni par l'app (todayLocal()), jamais current_date : le
-- serveur Postgres tourne en UTC chez Supabase, pas America/Toronto
-- (même piège que D18/D26).
create or replace function creer_facture(bon_id uuid, p_date date)
returns uuid as $$
declare
  v_bon bons_travail;
  v_total_pieces numeric(10,2);
  v_total_main_oeuvre numeric(10,2);
  v_total_ht numeric(10,2);
  v_taux_tps numeric(6,5);
  v_taux_tvq numeric(6,5);
  v_garantie_mois int;
  v_garantie_km int;
  v_montant_tps numeric(10,2);
  v_montant_tvq numeric(10,2);
  v_facture_id uuid;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent créer une facture.';
  end if;

  select * into v_bon from bons_travail where id = bon_id;
  if v_bon.id is null then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_bon.statut <> 'termine' then
    raise exception 'Seul un bon de travail terminé peut être facturé.';
  end if;

  select
    coalesce(sum(quantite * prix_unitaire) filter (where type = 'piece'), 0),
    coalesce(sum(quantite * prix_unitaire) filter (where type = 'main_oeuvre'), 0)
  into v_total_pieces, v_total_main_oeuvre
  from bon_travail_lignes where bon_travail_id = bon_id;

  v_total_ht := v_total_pieces + v_total_main_oeuvre;

  select taux_tps, taux_tvq, garantie_mois, garantie_km
  into v_taux_tps, v_taux_tvq, v_garantie_mois, v_garantie_km
  from parametres where id = 1;

  v_montant_tps := round(v_total_ht * v_taux_tps, 2);
  v_montant_tvq := round(v_total_ht * v_taux_tvq, 2);

  insert into factures (
    bon_travail_id, client_id, vehicule_id, date,
    total_pieces, total_main_oeuvre, total_ht,
    taux_tps, taux_tvq, montant_tps, montant_tvq, total_ttc,
    kilometrage, garantie_mois, garantie_km
  ) values (
    bon_id, v_bon.client_id, v_bon.vehicule_id, p_date,
    v_total_pieces, v_total_main_oeuvre, v_total_ht,
    v_taux_tps, v_taux_tvq, v_montant_tps, v_montant_tvq,
    v_total_ht + v_montant_tps + v_montant_tvq,
    v_bon.kilometrage, v_garantie_mois, v_garantie_km
  ) returning id into v_facture_id;

  insert into facture_lignes (facture_id, type, description, quantite, prix_unitaire, etat_piece, ordre)
  select v_facture_id, type, description, quantite, prix_unitaire, etat_piece, ordre
  from bon_travail_lignes where bon_travail_id = bon_id;

  update bons_travail set statut = 'facture' where id = bon_id;

  return v_facture_id;
end;
$$ language plpgsql security definer;

revoke execute on function creer_facture(uuid, date) from public;
grant execute on function creer_facture(uuid, date) to authenticated;
