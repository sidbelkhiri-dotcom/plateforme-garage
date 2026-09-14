-- ============================================================
-- Migration : 2026-10-13 — Loi 25 : fondations dans la base
--
-- Garagenda est le prestataire ; chaque garage reste responsable des
-- renseignements personnels de ses clients. Cette migration donne au
-- garage les moyens de ses obligations (Loi sur la protection des
-- renseignements personnels dans le secteur privé, telle que modifiée par
-- la Loi 25) :
--
--   1. l'identité de l'acheteur figée sur la facture, pour pouvoir effacer
--      un client sans altérer une pièce comptable qu'il faut conserver ;
--   2. le responsable de la protection des renseignements personnels (RPRP)
--      du garage, dont le titre et les coordonnées doivent être publiés ;
--   3. le consentement aux communications, demandé séparément et jamais
--      coché d'avance ;
--   4. la portabilité (export structuré) et l'anonymisation sur demande ;
--   5. la purge des demandes publiques dont la finalité est accomplie.
--
-- Rien ici n'est un avis juridique : les durées et les choix sont des
-- valeurs par défaut raisonnables, à faire valider.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Identité de l'acheteur figée sur la facture
--
-- La facture relisait nom, adresse et téléphone du client dans sa fiche,
-- en direct. Renommer un client réécrivait ses factures passées ; le
-- supprimer (clients → factures : on delete set null) les privait de leur
-- acheteur. Or une facture se conserve six ans pour l'impôt : on ne peut
-- ni la modifier ni l'effacer, ce qui rendait tout effacement de client
-- impossible à faire proprement.
-- ------------------------------------------------------------
alter table factures
  add column client_nom text,
  add column client_adresse text,
  add column client_telephone text,
  add column client_courriel text,
  add column vehicule_description text,
  add column vehicule_plaque text,
  add column vehicule_vin text;

-- Reprise de l'existant avant de figer les colonnes (le déclencheur de
-- protection ne les connaît pas encore, il laisse passer cette mise à jour).
update factures f set
  client_nom = c.nom,
  client_adresse = nullif(concat_ws(', ', nullif(c.adresse, ''), nullif(c.code_postal, '')), ''),
  client_telephone = c.telephone,
  client_courriel = c.email
from clients c
where c.id = f.client_id and f.client_nom is null;

update factures f set
  vehicule_description = nullif(trim(concat_ws(' ', v.marque, v.modele, case when v.annee is not null then '(' || v.annee || ')' end)), ''),
  vehicule_plaque = v.plaque,
  vehicule_vin = v.vin
from vehicules v
where v.id = f.vehicule_id and f.vehicule_description is null;

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
    or new.client_id is distinct from old.client_id and new.client_id is not null
    or new.vehicule_id is distinct from old.vehicule_id and new.vehicule_id is not null
    or new.date is distinct from old.date
    or new.numero is distinct from old.numero
    or new.garage_id is distinct from old.garage_id
    or new.client_nom is distinct from old.client_nom
    or new.client_adresse is distinct from old.client_adresse
    or new.client_telephone is distinct from old.client_telephone
    or new.client_courriel is distinct from old.client_courriel
    or new.vehicule_description is distinct from old.vehicule_description
    or new.vehicule_plaque is distinct from old.vehicule_plaque
    or new.vehicule_vin is distinct from old.vehicule_vin
  ) then
    raise exception 'Les montants, le numéro et l''identification d''une facture émise ne peuvent pas être modifiés — seul le paiement encaissé (montant_paye) peut évoluer.';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;
-- client_id et vehicule_id peuvent encore passer à null : c'est ce que fait
-- la suppression d'un client (on delete set null). L'identité reste lisible
-- sur la facture grâce aux colonnes figées ci-dessus.

create or replace function creer_facture(bon_id uuid, p_date date, p_sans_taxe boolean default false)
returns uuid as $$
declare
  v_bon bons_travail;
  v_client clients;
  v_vehicule vehicules;
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

  select * into v_client from clients where id = v_bon.client_id;
  select * into v_vehicule from vehicules where id = v_bon.vehicule_id;

  insert into factures (
    bon_travail_id, client_id, vehicule_id, date,
    total_pieces, total_main_oeuvre, total_ht,
    taux_tps, taux_tvq, montant_tps, montant_tvq, total_ttc,
    kilometrage, garantie_mois, garantie_km, sans_taxe,
    client_nom, client_adresse, client_telephone, client_courriel,
    vehicule_description, vehicule_plaque, vehicule_vin
  ) values (
    bon_id, v_bon.client_id, v_bon.vehicule_id, p_date,
    v_total_pieces, v_total_main_oeuvre, v_total_ht,
    v_taux_tps, v_taux_tvq, v_montant_tps, v_montant_tvq,
    v_total_ht + v_montant_tps + v_montant_tvq,
    v_bon.kilometrage, v_garantie_mois, v_garantie_km, p_sans_taxe,
    v_client.nom,
    nullif(concat_ws(', ', nullif(v_client.adresse, ''), nullif(v_client.code_postal, '')), ''),
    v_client.telephone, v_client.email,
    nullif(trim(concat_ws(' ', v_vehicule.marque, v_vehicule.modele, case when v_vehicule.annee is not null then '(' || v_vehicule.annee || ')' end)), ''),
    v_vehicule.plaque, v_vehicule.vin
  ) returning id into v_facture_id;

  insert into facture_lignes (facture_id, type, description, quantite, prix_unitaire, etat_piece, ordre)
  select v_facture_id, type, description, quantite, prix_unitaire, etat_piece, ordre
  from bon_travail_lignes where bon_travail_id = bon_id;

  update bons_travail set statut = 'facture' where id = bon_id;

  return v_facture_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;


-- ------------------------------------------------------------
-- 2. Responsable de la protection des renseignements personnels
--
-- Par défaut, la personne ayant la plus haute autorité dans l'entreprise ;
-- délégable par écrit. Son titre et ses coordonnées doivent être publiés.
-- ------------------------------------------------------------
alter table parametres
  add column rprp_nom text,
  add column rprp_titre text,
  add column rprp_courriel text;

create or replace function obtenir_garage_public(p_slug text)
returns jsonb as $$
  select jsonb_build_object(
    'id', g.id, 'nom', g.nom, 'adresse', g.adresse, 'telephone', g.telephone,
    'courriel', g.courriel,
    'rprp_nom', p.rprp_nom, 'rprp_titre', p.rprp_titre, 'rprp_courriel', p.rprp_courriel
  )
  from garages g
  left join parametres p on p.garage_id = g.id
  where g.slug = p_slug and g.statut = 'actif';
$$ language sql stable security definer set search_path = public, pg_temp;

revoke all on function obtenir_garage_public(text) from public;
grant execute on function obtenir_garage_public(text) to anon, authenticated;


-- ------------------------------------------------------------
-- 3. Consentement aux communications
--
-- Les rappels d'entretien, demandes d'avis et relances de réparations
-- refusées dépassent la finalité première (faire la réparation demandée).
-- Le consentement est demandé à part, case non cochée par défaut, et
-- daté pour pouvoir en faire la preuve.
-- ------------------------------------------------------------
alter table clients
  add column consentement_communications boolean not null default false,
  add column consentement_communications_le timestamptz,
  add column anonymise_le timestamptz;

alter table demandes_accueil
  add column consentement_communications boolean not null default false;
alter table demandes_rendez_vous
  add column consentement_communications boolean not null default false;

-- La date suit la case : cochée → maintenant ; décochée → vide. Posée par
-- la base pour qu'aucun écran ne l'oublie ni ne la falsifie.
create or replace function dater_consentement_client()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.consentement_communications is distinct from old.consentement_communications then
    new.consentement_communications_le := case when new.consentement_communications then now() end;
  else
    -- La date n'est jamais écrite à la main : sans changement de la case,
    -- elle reste celle qu'avait posée la base.
    new.consentement_communications_le := old.consentement_communications_le;
  end if;
  return new;
end;
$$;

revoke execute on function dater_consentement_client() from public, anon, authenticated;

drop trigger if exists clients_dater_consentement on clients;
create trigger clients_dater_consentement
  before insert or update of consentement_communications, consentement_communications_le on clients
  for each row execute function dater_consentement_client();


-- ------------------------------------------------------------
-- 4. Droits de la personne : portabilité et anonymisation
-- ------------------------------------------------------------

-- Tout ce que le garage détient sur un client, dans un format structuré et
-- couramment utilisé (JSON). Réponse à une demande d'accès ou de
-- portabilité : le délai légal est de 30 jours.
create or replace function exporter_client(p_client_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_client clients;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent exporter les renseignements d''un client.';
  end if;
  select * into v_client from clients where id = p_client_id and garage_id = garage_actuel();
  if v_client.id is null then
    raise exception 'Client introuvable.';
  end if;

  return jsonb_build_object(
    'format', 'Garagenda — renseignements personnels d''un client, v1',
    'exporte_le', now(),
    'garage', (select jsonb_build_object('nom', nom, 'adresse', adresse, 'telephone', telephone, 'courriel', courriel)
               from parametres where garage_id = v_client.garage_id),
    'client', jsonb_build_object(
      'nom', v_client.nom, 'telephone', v_client.telephone, 'courriel', v_client.email,
      'adresse', v_client.adresse, 'code_postal', v_client.code_postal, 'notes', v_client.notes,
      'consentement_communications', v_client.consentement_communications,
      'consentement_communications_le', v_client.consentement_communications_le,
      'cree_le', v_client.created_at),
    'vehicules', coalesce((select jsonb_agg(jsonb_build_object(
        'marque', marque, 'modele', modele, 'annee', annee, 'plaque', plaque, 'niv', vin, 'couleur', couleur))
      from vehicules where client_id = v_client.id), '[]'::jsonb),
    'rendez_vous', coalesce((select jsonb_agg(jsonb_build_object(
        'date', date, 'heure', heure, 'description', description, 'statut', statut) order by date)
      from rendez_vous where client_id = v_client.id), '[]'::jsonb),
    'bons_de_travail', coalesce((select jsonb_agg(jsonb_build_object(
        'numero', b.numero, 'ouvert_le', b.ouvert_le, 'statut', b.statut, 'kilometrage', b.kilometrage,
        'plainte', b.plainte_client, 'diagnostic', b.diagnostic,
        'montant_evaluation', b.montant_evaluation, 'evaluation_acceptee_le', b.evaluation_acceptee_le,
        'lignes', coalesce((select jsonb_agg(jsonb_build_object(
            'type', l.type, 'description', l.description, 'quantite', l.quantite, 'prix_unitaire', l.prix_unitaire))
          from bon_travail_lignes l where l.bon_travail_id = b.id), '[]'::jsonb)) order by b.ouvert_le)
      from bons_travail b where b.client_id = v_client.id), '[]'::jsonb),
    'factures', coalesce((select jsonb_agg(jsonb_build_object(
        'numero', f.numero, 'date', f.date, 'statut', f.statut, 'total_avant_taxes', f.total_ht,
        'tps', f.montant_tps, 'tvq', f.montant_tvq, 'total', f.total_ttc, 'paye', f.montant_paye) order by f.date)
      from factures f where f.client_id = v_client.id), '[]'::jsonb)
  );
end;
$$;

revoke execute on function exporter_client(uuid) from public, anon;
grant execute on function exporter_client(uuid) to authenticated;

-- Effacement à la demande du client, quand des factures doivent être
-- conservées : la fiche perd tout ce qui identifie la personne, les
-- véhicules perdent plaque et NIV. Les factures gardent leur identité figée
-- (section 1) : elles restent des pièces comptables valables, et ne sont
-- consultées qu'à ce titre. Réservé à l'administrateur, irréversible.
create or replace function anonymiser_client(p_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_client clients;
begin
  if not est_role('admin') or not garage_operationnel() then
    raise exception 'Seul l''administrateur d''un garage actif peut anonymiser un client.';
  end if;
  select * into v_client from clients where id = p_client_id and garage_id = garage_actuel();
  if v_client.id is null then
    raise exception 'Client introuvable.';
  end if;
  if v_client.anonymise_le is not null then
    raise exception 'Ce client est déjà anonymisé.';
  end if;

  update clients set
    nom = 'Client anonymisé',
    telephone = null, email = null, adresse = null, code_postal = null, notes = null,
    taux_horaire = null, consentement_communications = false, anonymise_le = now()
  where id = v_client.id;

  update vehicules set plaque = null, vin = null where client_id = v_client.id;

  -- Les rendez-vous à venir n'ont plus de raison d'être.
  delete from rendez_vous where client_id = v_client.id and date >= current_date;
end;
$$;

revoke execute on function anonymiser_client(uuid) from public, anon;
grant execute on function anonymiser_client(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. Purge des demandes publiques
--
-- Une demande d'arrivée ou de rendez-vous traitée a produit une fiche
-- client ou un rendez-vous : la demande elle-même n'a plus de finalité.
-- Traitée ou ignorée : effacée après 90 jours. Jamais traitée : après un
-- an. Appelée chaque jour par la tâche planifiée (clé service).
-- ------------------------------------------------------------
create or replace function purger_demandes_publiques()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_accueil int;
  v_rdv int;
begin
  delete from demandes_accueil
   where (statut <> 'nouvelle' and created_at < now() - interval '90 days')
      or created_at < now() - interval '1 year';
  get diagnostics v_accueil = row_count;

  delete from demandes_rendez_vous
   where (statut <> 'nouvelle' and created_at < now() - interval '90 days')
      or created_at < now() - interval '1 year';
  get diagnostics v_rdv = row_count;

  return jsonb_build_object('demandes_accueil', v_accueil, 'demandes_rendez_vous', v_rdv);
end;
$$;

revoke execute on function purger_demandes_publiques() from public, anon, authenticated;
grant execute on function purger_demandes_publiques() to service_role;

notify pgrst, 'reload schema';

select 'loi 25 : fondations en place' as resultat;
