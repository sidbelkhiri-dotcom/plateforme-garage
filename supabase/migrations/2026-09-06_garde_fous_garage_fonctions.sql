-- ============================================================
-- Migration : 2026-09-06 — garde-fous garage sur les fonctions security
-- definer critiques (étape 4/6, partie 2 — fin de l'étape 4)
--
-- Une fonction security definer contourne la RLS par nature (c'est son
-- but). Sans un garde-fou explicite dans son propre corps, un compte
-- admin/reception du garage A pouvait faire accepter une évaluation,
-- créer/annuler une facture ou encaisser un paiement sur un bon ou une
-- facture du garage B, simplement en connaissant son id — RLS ne le
-- protège jamais puisque ces fonctions ne la traversent pas.
--
-- Message d'erreur volontairement identique au cas « introuvable » —
-- jamais un message distinct pour « ça existe mais pas dans ton garage »,
-- sinon la fonction devient un oracle qui confirme l'existence d'ids
-- appartenant à d'autres garages.
-- ============================================================

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
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function annuler_facture(facture_id uuid, motif text)
returns void as $$
declare
  v_garage_id uuid;
  v_bon_travail_id uuid;
  v_statut_actuel text;
begin
  if not est_role('admin') then
    raise exception 'Seul l''administrateur peut annuler une facture.';
  end if;
  if motif is null or trim(motif) = '' then
    raise exception 'Un motif est obligatoire pour annuler une facture.';
  end if;

  select garage_id, bon_travail_id, statut into v_garage_id, v_bon_travail_id, v_statut_actuel
  from factures where id = facture_id;

  if v_statut_actuel is null or v_garage_id <> garage_actuel() then
    raise exception 'Facture introuvable.';
  end if;
  if v_statut_actuel = 'annulee' then
    raise exception 'Cette facture est déjà annulée.';
  end if;

  update factures
  set statut = 'annulee',
      motif_annulation = motif,
      annulee_le = now(),
      annulee_par = auth.uid()
  where id = facture_id;

  if v_bon_travail_id is not null then
    update bons_travail set statut = 'termine' where id = v_bon_travail_id and statut = 'facture';
  end if;
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

  select validite_evaluation_jours into v_validite_jours from parametres where id = 1;

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

  select validite_evaluation_jours into v_validite_jours from parametres where id = 1;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_valide_jusqu_au = current_date + v_validite_jours
  where id = bon_id;

  insert into bon_travail_evaluations (bon_travail_id, montant, type, accepte_par)
  values (bon_id, v_total, 'complementaire', auth.uid());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function renoncer_evaluation(bon_id uuid)
returns void as $$
declare
  v_garage_id uuid;
  v_statut text;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent enregistrer une renonciation.';
  end if;

  select garage_id, statut into v_garage_id, v_statut from bons_travail where id = bon_id;
  if v_statut is null or v_garage_id <> garage_actuel() then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_statut <> 'evaluation' then
    raise exception 'Ce bon n''est plus en évaluation — il a déjà été traité. Rechargez la page.';
  end if;

  update bons_travail
  set renonciation_ecrite = true,
      evaluation_acceptee_le = now(),
      statut = 'autorise'
  where id = bon_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function enregistrer_paiement(p_facture_id uuid, p_montant numeric)
returns void as $$
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent enregistrer un paiement.';
  end if;
  if p_montant is null or p_montant <= 0 then
    raise exception 'Le montant reçu doit être positif.';
  end if;

  update factures
  set montant_paye = least(montant_paye + p_montant, total_ttc)
  where id = p_facture_id
    and statut <> 'annulee'
    and garage_id = garage_actuel();

  if not found then
    raise exception 'Facture introuvable ou annulée.';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
