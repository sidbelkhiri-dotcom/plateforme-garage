-- ============================================================
-- Migration : 2026-09-14 — parametres devient une ligne par garage
--
-- Jusqu'ici, parametres était un singleton (id=1) partagé par toute
-- l'application — chaque garage a besoin du sien (adresse, taux de
-- taxes, valeurs par défaut de garantie). garage_id devient la clé
-- primaire ; l'ancienne colonne id disparaît.
--
-- Còté application : les lectures faisaient `.eq("id", 1).single()` —
-- il suffit de retirer le `.eq(...)`, la RLS scope déjà à la bonne
-- ligne (garage_id = garage_actuel()). Un update sans `.eq()` reste
-- lui aussi correctement scopé : RLS agit comme un WHERE implicite.
-- ============================================================

alter table parametres add column garage_id uuid references garages(id);
update parametres set garage_id = (select id from garages where nom = 'Atelier pilote (développement)');
alter table parametres alter column garage_id set not null;

alter table parametres drop constraint parametres_pkey;
alter table parametres add primary key (garage_id);
alter table parametres drop column id;

drop policy "parametres_select_all" on parametres;
create policy "parametres_select_all" on parametres
  for select using (garage_id = garage_actuel());

drop policy "parametres_update_admin" on parametres;
create policy "parametres_update_admin" on parametres
  for update using (est_role('admin') and garage_id = garage_actuel())
  with check (est_role('admin') and garage_id = garage_actuel());

-- Les fonctions security definer contournent la RLS : elles lisaient
-- `parametres where id = 1`, donc toujours le même garage quel que soit
-- l'appelant. Corrigé pour lire le garage du bon/de la facture concernée.
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
  if v_bon.id is null or v_bon.garage_id <> garage_actuel() then
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

  select garantie_mois, garantie_km into v_garantie_mois, v_garantie_km
  from parametres where garage_id = v_bon.garage_id;

  if p_sans_taxe then
    v_taux_tps := 0;
    v_taux_tvq := 0;
    v_montant_tps := 0;
    v_montant_tvq := 0;
  else
    select taux_tps, taux_tvq into v_taux_tps, v_taux_tvq
    from parametres where garage_id = v_bon.garage_id;
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
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function accepter_evaluation(bon_id uuid, p_montant_attendu numeric)
returns void as $$
declare
  v_garage_id uuid;
  v_total numeric(10,2);
  v_validite_jours int;
  v_statut text;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent accepter une évaluation.';
  end if;

  select garage_id, statut into v_garage_id, v_statut from bons_travail where id = bon_id;
  if v_statut is null or v_garage_id <> garage_actuel() then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_statut <> 'evaluation' then
    raise exception 'Ce bon n''est plus en évaluation — il a déjà été traité. Rechargez la page.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  if v_total is distinct from p_montant_attendu then
    raise exception 'Le montant a changé depuis l''affichage (une ligne a été ajoutée ou modifiée). Rechargez la page et recommencez.';
  end if;

  select validite_evaluation_jours into v_validite_jours from parametres where garage_id = v_garage_id;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_acceptee_le = now(),
      evaluation_valide_jusqu_au = current_date + v_validite_jours,
      statut = 'autorise'
  where id = bon_id;

  insert into bon_travail_evaluations (bon_travail_id, montant, type, accepte_par)
  values (bon_id, v_total, 'initiale', auth.uid());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function reevaluer_bon(bon_id uuid, p_montant_attendu numeric)
returns void as $$
declare
  v_garage_id uuid;
  v_total numeric(10,2);
  v_validite_jours int;
  v_statut text;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent réévaluer un bon de travail.';
  end if;

  select garage_id, statut into v_garage_id, v_statut from bons_travail where id = bon_id;
  if v_statut is null or v_garage_id <> garage_actuel() then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_statut not in ('autorise', 'en_cours', 'attente_piece') then
    raise exception 'La réévaluation complémentaire ne s''applique qu''à un bon déjà autorisé.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  if v_total is distinct from p_montant_attendu then
    raise exception 'Le montant a changé depuis l''affichage. Rechargez la page et recommencez.';
  end if;

  select validite_evaluation_jours into v_validite_jours from parametres where garage_id = v_garage_id;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_valide_jusqu_au = current_date + v_validite_jours
  where id = bon_id;

  insert into bon_travail_evaluations (bon_travail_id, montant, type, accepte_par)
  values (bon_id, v_total, 'complementaire', auth.uid());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
