-- ============================================================
-- Migration : 2026-08-17 — facturer sans taxe (choix explicite à l'émission)
-- Certaines factures se font sans TPS/TVQ. `sans_taxe` est un choix
-- explicite tracé sur la facture (pas juste des taux à 0 dans
-- `parametres`, qui changerait tout le monde) — même principe que
-- `renonciation_ecrite` sur les bons de travail : un booléen qui rend
-- une décision commerciale visible, pas une valeur devinée après coup.
-- Figé à l'émission comme le reste des montants (D13/D31) — ajouté au
-- trigger de protection.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table factures add column sans_taxe boolean not null default false;

-- creer_facture() : nouveau paramètre optionnel p_sans_taxe (défaut
-- false, donc tout appel existant à 2 arguments continue de facturer
-- avec taxe comme avant). Taxes mises à 0 explicitement plutôt que de
-- sauter la lecture de parametres — pour que le calcul reste visible et
-- identique en forme, juste à taux nul.
create or replace function creer_facture(bon_id uuid, p_date date, p_sans_taxe boolean default false)
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

  select garantie_mois, garantie_km into v_garantie_mois, v_garantie_km from parametres where id = 1;

  if p_sans_taxe then
    v_taux_tps := 0;
    v_taux_tvq := 0;
    v_montant_tps := 0;
    v_montant_tvq := 0;
  else
    select taux_tps, taux_tvq into v_taux_tps, v_taux_tvq from parametres where id = 1;
    v_montant_tps := round(v_total_ht * v_taux_tps, 2);
    v_montant_tvq := round(v_total_ht * v_taux_tvq, 2);
  end if;

  insert into factures (
    bon_travail_id, client_id, vehicule_id, date,
    total_pieces, total_main_oeuvre, total_ht,
    taux_tps, taux_tvq, montant_tps, montant_tvq, total_ttc,
    kilometrage, garantie_mois, garantie_km, sans_taxe
  ) values (
    bon_id, v_bon.client_id, v_bon.vehicule_id, p_date,
    v_total_pieces, v_total_main_oeuvre, v_total_ht,
    v_taux_tps, v_taux_tvq, v_montant_tps, v_montant_tvq,
    v_total_ht + v_montant_tps + v_montant_tvq,
    v_bon.kilometrage, v_garantie_mois, v_garantie_km, p_sans_taxe
  ) returning id into v_facture_id;

  insert into facture_lignes (facture_id, type, description, quantite, prix_unitaire, etat_piece, ordre)
  select v_facture_id, type, description, quantite, prix_unitaire, etat_piece, ordre
  from bon_travail_lignes where bon_travail_id = bon_id;

  update bons_travail set statut = 'facture' where id = bon_id;

  return v_facture_id;
end;
$$ language plpgsql security definer;

revoke execute on function creer_facture(uuid, date, boolean) from public;
grant execute on function creer_facture(uuid, date, boolean) to authenticated;

-- D31 : sans_taxe fait maintenant partie des champs figés à l'émission,
-- même trou de classe que les montants/taux (une facture émise ne doit
-- plus jamais changer de traitement fiscal après coup).
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
    or new.sans_taxe is distinct from old.sans_taxe
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
