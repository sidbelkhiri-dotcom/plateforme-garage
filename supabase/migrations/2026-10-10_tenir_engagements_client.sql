-- ============================================================
-- Migration : 2026-10-10 — tenir les engagements pris devant le client
--
-- La suite scripts/conformite.mjs, jouée avec la session d'un ADMIN de
-- garage, a trouvé cinq règles que l'application affiche mais que la base
-- ne fait pas respecter :
--
--   1. un bon jamais évalué passait « en cours » par un simple PATCH ;
--   2. il pouvait donc être terminé puis facturé, sans évaluation écrite ni
--      renonciation — l'obligation que la page du bon qualifie elle-même
--      d'« exigence légale, pas une formalité » ;
--   3. l'admin et la réception pouvaient réécrire montant_evaluation
--      directement : le prix que le client a accepté changeait sans
--      nouvelle acceptation, et sans trace dans bon_travail_evaluations ;
--   4. creer_facture() facturait la somme des lignes du moment, même
--      au-dessus du montant accepté. L'évaluation imprimée promet pourtant
--      qu'il n'y aura aucun dépassement sans nouvelle évaluation acceptée ;
--      seul un bandeau rouge à l'écran le rappelait ;
--   5. le numéro d'une facture émise se modifiait (FA-0003 → FA-9999),
--      ce qui ouvre un trou dans la suite des numéros.
--
-- proteger_autorisation_bon() ne vérifiait que le RÔLE : c'est la bonne
-- garde contre un mécanicien, pas contre le garage lui-même. Les champs
-- d'évaluation ne se posent plus désormais QUE par les trois gestes prévus
-- — accepter_evaluation(), reevaluer_bon(), renoncer_evaluation() — qui
-- lèvent un drapeau local à leur transaction (set_config(..., true)).
-- Aucun client ne peut lever ce drapeau : PostgREST n'expose pas
-- set_config, et chaque requête HTTP est sa propre transaction.
--
-- Effet sur l'application : aucun parcours normal ne change. Seul ajout,
-- la réévaluation complémentaire est maintenant permise sur un bon
-- « terminé » : sans ça, un dépassement découvert au moment de facturer
-- n'aurait plus d'issue.
-- ============================================================


-- ------------------------------------------------------------
-- 1 à 3 — les champs d'évaluation et l'entrée en travaux
-- ------------------------------------------------------------

create or replace function proteger_autorisation_bon()
returns trigger as $$
declare
  v_geste boolean := coalesce(current_setting('garagenda.geste_evaluation', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.statut is distinct from 'evaluation'
       or new.montant_evaluation is not null
       or new.evaluation_acceptee_le is not null
       or new.evaluation_valide_jusqu_au is not null
       or coalesce(new.renonciation_ecrite, false) then
      raise exception 'Un bon de travail commence toujours en évaluation : l''autorisation du client se donne ensuite, par acceptation ou renonciation écrite.';
    end if;
    return new;
  end if;

  if (
    (new.statut = 'autorise' and old.statut <> 'autorise')
    or new.montant_evaluation     is distinct from old.montant_evaluation
    or new.evaluation_acceptee_le is distinct from old.evaluation_acceptee_le
    or new.renonciation_ecrite    is distinct from old.renonciation_ecrite
    or (old.statut in ('termine', 'facture', 'annule')
        and new.statut is distinct from old.statut)
  ) and not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent autoriser, réévaluer ou rouvrir un bon de travail.';
  end if;

  if (
    (new.statut = 'autorise' and old.statut <> 'autorise')
    or new.montant_evaluation         is distinct from old.montant_evaluation
    or new.evaluation_acceptee_le     is distinct from old.evaluation_acceptee_le
    or new.evaluation_valide_jusqu_au is distinct from old.evaluation_valide_jusqu_au
    or new.renonciation_ecrite        is distinct from old.renonciation_ecrite
  ) and not v_geste then
    raise exception 'Le montant accepté par le client ne change que par une acceptation ou une réévaluation complémentaire, jamais par une modification directe.';
  end if;

  if new.statut in ('en_cours', 'attente_piece', 'termine')
     and new.statut is distinct from old.statut
     and new.evaluation_acceptee_le is null then
    raise exception 'Aucun travail sans évaluation écrite acceptée par le client ou renonciation écrite.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists proteger_autorisation_bon_trigger on bons_travail;
create trigger proteger_autorisation_bon_trigger
  before insert or update on bons_travail
  for each row execute function proteger_autorisation_bon();


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

  perform set_config('garagenda.geste_evaluation', 'on', true);
  update bons_travail
  set montant_evaluation = v_total,
      evaluation_acceptee_le = now(),
      evaluation_valide_jusqu_au = current_date + v_validite_jours,
      statut = 'autorise'
  where id = bon_id;
  perform set_config('garagenda.geste_evaluation', 'off', true);

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
  -- « termine » ajouté : c'est au moment de facturer qu'on découvre le plus
  -- souvent un dépassement, et creer_facture() le refuse désormais.
  if v_statut not in ('autorise', 'en_cours', 'attente_piece', 'termine') then
    raise exception 'La réévaluation complémentaire ne s''applique qu''à un bon déjà autorisé et pas encore facturé.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  if v_total is distinct from p_montant_attendu then
    raise exception 'Le montant a changé depuis l''affichage. Rechargez la page et recommencez.';
  end if;

  select validite_evaluation_jours into v_validite_jours from parametres where garage_id = v_garage_id;

  perform set_config('garagenda.geste_evaluation', 'on', true);
  update bons_travail
  set montant_evaluation = v_total,
      evaluation_valide_jusqu_au = current_date + v_validite_jours
  where id = bon_id;
  perform set_config('garagenda.geste_evaluation', 'off', true);

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

  perform set_config('garagenda.geste_evaluation', 'on', true);
  update bons_travail
  set renonciation_ecrite = true,
      evaluation_acceptee_le = now(),
      statut = 'autorise'
  where id = bon_id;
  perform set_config('garagenda.geste_evaluation', 'off', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;


-- ------------------------------------------------------------
-- 2 et 4 — creer_facture() vérifie l'autorisation et le plafond
-- ------------------------------------------------------------

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
  -- Défense en profondeur : le trigger empêche déjà d'arriver à « terminé »
  -- sans autorisation, mais un bon terminé avant cette migration a pu le faire.
  if v_bon.evaluation_acceptee_le is null then
    raise exception 'Ce bon n''a jamais été autorisé par le client (évaluation acceptée ou renonciation écrite) : il ne peut pas être facturé.';
  end if;

  select
    coalesce(sum(quantite * prix_unitaire) filter (where type = 'piece'), 0),
    coalesce(sum(quantite * prix_unitaire) filter (where type = 'main_oeuvre'), 0)
  into v_total_pieces, v_total_main_oeuvre
  from bon_travail_lignes where bon_travail_id = bon_id;

  v_total_ht := v_total_pieces + v_total_main_oeuvre;

  if not coalesce(v_bon.renonciation_ecrite, false)
     and v_bon.montant_evaluation is not null
     and v_total_ht > v_bon.montant_evaluation then
    raise exception 'Le total des travaux (% $ avant taxes) dépasse l''évaluation acceptée par le client (% $). Faites accepter une réévaluation complémentaire avant de facturer.',
      to_char(v_total_ht, 'FM999999990.00'), to_char(v_bon.montant_evaluation, 'FM999999990.00');
  end if;

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


-- ------------------------------------------------------------
-- 5 — le numéro (et le garage) d'une facture émise sont figés
-- ------------------------------------------------------------

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
    or new.numero is distinct from old.numero
    or new.garage_id is distinct from old.garage_id
  ) then
    raise exception 'Les montants, le numéro et l''identification d''une facture émise ne peuvent pas être modifiés — seul le paiement encaissé (montant_paye) peut évoluer.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;


-- Les droits d'exécution survivent à create or replace ; on les réaffirme
-- quand même, la leçon de reevaluer_bon() (25 août) valant pour toutes.
revoke execute on function proteger_autorisation_bon() from public, anon, authenticated;
revoke execute on function proteger_montants_facture() from public, anon, authenticated;
revoke execute on function accepter_evaluation(uuid, numeric) from public, anon;
revoke execute on function reevaluer_bon(uuid, numeric) from public, anon;
revoke execute on function renoncer_evaluation(uuid) from public, anon;
revoke execute on function creer_facture(uuid, date, boolean) from public, anon;
grant execute on function accepter_evaluation(uuid, numeric) to authenticated;
grant execute on function reevaluer_bon(uuid, numeric) to authenticated;
grant execute on function renoncer_evaluation(uuid) to authenticated;
grant execute on function creer_facture(uuid, date, boolean) to authenticated;

select 'engagements client verrouillés' as resultat;
