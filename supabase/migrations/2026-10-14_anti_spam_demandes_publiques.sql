-- ============================================================
-- Migration : 2026-10-14 — anti-spam des formulaires publics
--
-- Les pages d'arrivée au comptoir et de demande de rendez-vous inséraient
-- directement dans demandes_accueil et demandes_rendez_vous, sous une
-- politique qui n'exigeait qu'un garage_id. Le piège à robots de la page
-- ne sert à rien contre un envoi direct à l'API : n'importe qui pouvait
-- déposer des milliers de demandes dans la boîte d'un garage, avec des
-- textes de n'importe quelle longueur, ou viser un garage suspendu.
--
-- L'écriture directe est fermée. Deux fonctions deviennent les seules
-- portes, et elles font ce qu'une politique ne sait pas faire :
--   - résoudre le garage par son slug (actif seulement), jamais par un
--     identifiant envoyé par le navigateur ;
--   - valider les champs : obligatoires, longueurs, formats, dates ;
--   - ignorer un double envoi (même contact, même garage, 10 minutes) en
--     répondant « reçu » sans créer de doublon ;
--   - limiter la fréquence, par appareil et par garage.
--
-- L'APPAREIL, SANS GARDER D'ADRESSE IP
-- L'adresse IP est lue dans les en-têtes transmis par l'API (cf-connecting-
-- ip, posé par Cloudflare en amont de Supabase et que le client ne peut pas
-- fixer ; à défaut x-real-ip, puis x-forwarded-for). Elle n'est jamais
-- stockée : seule une empreinte salée (md5 avec un sel aléatoire propre à
-- la base) est gardée, 24 heures au plus. Sans IP disponible, les limites
-- par appareil ne s'appliquent pas, les autres restent.
--
-- LES SEUILS, ET POURQUOI
-- Une borne d'accueil peut être une tablette au comptoir, sur le wifi du
-- garage : tous ses clients partagent alors une IP. D'où des seuils larges
-- pour l'accueil et serrés pour la demande de rendez-vous, qu'un même
-- appareil n'a aucune raison d'envoyer en rafale.
--   même appareil, même garage, 10 min : accueil 10, rendez-vous 3
--   même appareil, tous garages, 1 h    : 30
--   même garage, 1 h                    : accueil 60, rendez-vous 30
-- ============================================================

-- ------------------------------------------------------------
-- Traces de fréquence et sel
-- ------------------------------------------------------------
create table demandes_publiques_traces (
  id bigint generated always as identity primary key,
  empreinte_appareil text not null,
  empreinte_cible text not null,
  cree_le timestamptz not null default now()
);
create index demandes_publiques_traces_appareil on demandes_publiques_traces (empreinte_appareil, cree_le);
create index demandes_publiques_traces_cible on demandes_publiques_traces (empreinte_cible, cree_le);

create table demandes_publiques_sel (
  id boolean primary key default true check (id),
  sel text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into demandes_publiques_sel default values;

-- Aucun accès depuis l'API : seules les fonctions ci-dessous lisent et
-- écrivent. La politique explicite dit « personne », là où une table sans
-- politique laisserait croire à un oubli (et l'audit de la suite
-- d'isolation le signalerait).
alter table demandes_publiques_traces enable row level security;
alter table demandes_publiques_sel enable row level security;
create policy "aucun_acces_api" on demandes_publiques_traces for all using (false) with check (false);
create policy "aucun_acces_api" on demandes_publiques_sel for all using (false) with check (false);
revoke all on demandes_publiques_traces, demandes_publiques_sel from anon, authenticated;


-- ------------------------------------------------------------
-- Fermer l'écriture directe
-- ------------------------------------------------------------
drop policy if exists "demandes_accueil_insert_public" on demandes_accueil;
drop policy if exists "demandes_rdv_insert_public" on demandes_rendez_vous;


-- ------------------------------------------------------------
-- Contrôle commun : garage, appareil, fréquence
-- ------------------------------------------------------------
create or replace function controler_demande_publique(p_slug text, p_type text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_garage uuid;
  v_entetes jsonb;
  v_ip text;
  v_sel text;
  v_appareil text;
  v_cible text;
  v_par_cible int;
  v_par_appareil int;
  v_par_garage int;
  c_limite_cible int := case p_type when 'accueil' then 10 else 3 end;
  c_limite_garage int := case p_type when 'accueil' then 60 else 30 end;
  c_message_frequence text := 'Trop de demandes envoyées depuis cet appareil. Réessayez dans quelques minutes, ou appelez directement le garage.';
begin
  select id into v_garage from garages where slug = p_slug and statut = 'actif';
  if v_garage is null then
    raise exception 'Ce garage n''accepte pas de demandes en ligne pour le moment.';
  end if;

  -- Par garage : protège la boîte d'un garage même quand l'IP manque ou
  -- change à chaque envoi.
  if p_type = 'accueil' then
    select count(*) into v_par_garage from demandes_accueil
     where garage_id = v_garage and created_at > now() - interval '1 hour';
  else
    select count(*) into v_par_garage from demandes_rendez_vous
     where garage_id = v_garage and created_at > now() - interval '1 hour';
  end if;
  if v_par_garage >= c_limite_garage then
    raise exception 'Le garage reçoit beaucoup de demandes en ce moment. Réessayez un peu plus tard, ou appelez-le directement.';
  end if;

  begin
    v_entetes := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_entetes := null;
  end;
  v_ip := nullif(trim(coalesce(
    v_entetes->>'cf-connecting-ip',
    v_entetes->>'x-real-ip',
    split_part(coalesce(v_entetes->>'x-forwarded-for', ''), ',', 1)
  )), '');

  if v_ip is not null then
    delete from demandes_publiques_traces where cree_le < now() - interval '1 day';

    select sel into v_sel from demandes_publiques_sel;
    v_appareil := md5(v_sel || '|' || v_ip);
    v_cible := md5(v_sel || '|' || v_ip || '|' || v_garage::text || '|' || p_type);

    select count(*) into v_par_cible from demandes_publiques_traces
     where empreinte_cible = v_cible and cree_le > now() - interval '10 minutes';
    select count(*) into v_par_appareil from demandes_publiques_traces
     where empreinte_appareil = v_appareil and cree_le > now() - interval '1 hour';
    if v_par_cible >= c_limite_cible or v_par_appareil >= 30 then
      raise exception '%', c_message_frequence;
    end if;

    insert into demandes_publiques_traces (empreinte_appareil, empreinte_cible) values (v_appareil, v_cible);
  end if;

  return v_garage;
end;
$$;

revoke execute on function controler_demande_publique(text, text) from public, anon, authenticated;

-- Texte libre : vide → null, espaces retirés, longueur bornée.
create or replace function texte_demande(p_valeur text, p_max int, p_champ text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := nullif(trim(coalesce(p_valeur, '')), '');
begin
  if v is not null and char_length(v) > p_max then
    raise exception 'Le champ « % » est trop long (% caractères au plus).', p_champ, p_max;
  end if;
  return v;
end;
$$;

revoke execute on function texte_demande(text, int, text) from public, anon, authenticated;


-- ------------------------------------------------------------
-- Arrivée au comptoir
-- ------------------------------------------------------------
create or replace function deposer_demande_accueil(p_slug text, p_donnees jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_garage uuid;
  v_nom text := texte_demande(p_donnees->>'nom', 120, 'Nom');
  v_telephone text := texte_demande(p_donnees->>'telephone', 30, 'Téléphone');
  v_courriel text := lower(texte_demande(p_donnees->>'courriel', 200, 'Courriel'));
  v_adresse text := texte_demande(p_donnees->>'adresse', 200, 'Adresse');
  v_code_postal text := upper(texte_demande(p_donnees->>'code_postal', 10, 'Code postal'));
  v_marque text := texte_demande(p_donnees->>'marque', 60, 'Marque');
  v_modele text := texte_demande(p_donnees->>'modele', 60, 'Modèle');
  v_annee_texte text := texte_demande(p_donnees->>'annee', 4, 'Année');
  v_vin text := upper(texte_demande(p_donnees->>'vin', 20, 'NIV'));
  v_plainte text := texte_demande(p_donnees->>'plainte', 2000, 'Description du problème');
  v_annee int;
begin
  if v_nom is null then
    raise exception 'Indiquez votre nom.';
  end if;
  if v_courriel is not null and v_courriel !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'L''adresse courriel semble incomplète.';
  end if;
  if v_annee_texte is not null then
    if v_annee_texte !~ '^\d{4}$' then
      raise exception 'L''année du véhicule doit compter quatre chiffres.';
    end if;
    v_annee := v_annee_texte::int;
    if v_annee < 1900 or v_annee > extract(year from current_date)::int + 2 then
      raise exception 'L''année du véhicule semble inexacte.';
    end if;
  end if;

  v_garage := controler_demande_publique(p_slug, 'accueil');

  -- Double envoi (double tap, rechargement) : déjà reçu, pas de doublon.
  if exists (
    select 1 from demandes_accueil
     where garage_id = v_garage and created_at > now() - interval '10 minutes'
       and lower(nom) = lower(v_nom)
       and coalesce(regexp_replace(telephone, '\D', '', 'g'), '') = coalesce(regexp_replace(v_telephone, '\D', '', 'g'), '')
       and coalesce(lower(courriel), '') = coalesce(v_courriel, '')
  ) then
    return jsonb_build_object('ok', true, 'doublon', true);
  end if;

  insert into demandes_accueil (
    garage_id, nom, telephone, courriel, adresse, code_postal,
    marque, modele, annee, vin, plainte, consentement_communications
  ) values (
    v_garage, v_nom, v_telephone, v_courriel, v_adresse, v_code_postal,
    v_marque, v_modele, v_annee, v_vin, v_plainte,
    coalesce((p_donnees->>'consentement_communications')::boolean, false)
  );

  return jsonb_build_object('ok', true, 'doublon', false);
end;
$$;

revoke execute on function deposer_demande_accueil(text, jsonb) from public;
grant execute on function deposer_demande_accueil(text, jsonb) to anon, authenticated;


-- ------------------------------------------------------------
-- Demande de rendez-vous
-- ------------------------------------------------------------
create or replace function deposer_demande_rendez_vous(p_slug text, p_donnees jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_garage uuid;
  v_nom text := texte_demande(p_donnees->>'nom', 120, 'Nom');
  v_telephone text := texte_demande(p_donnees->>'telephone', 30, 'Téléphone');
  v_courriel text := lower(texte_demande(p_donnees->>'courriel', 200, 'Courriel'));
  v_marque text := texte_demande(p_donnees->>'marque', 60, 'Marque');
  v_modele text := texte_demande(p_donnees->>'modele', 60, 'Modèle');
  v_annee_texte text := texte_demande(p_donnees->>'annee', 4, 'Année');
  v_service text := texte_demande(p_donnees->>'service', 100, 'Service');
  v_date_texte text := texte_demande(p_donnees->>'date_souhaitee', 10, 'Date souhaitée');
  v_plage text := coalesce(texte_demande(p_donnees->>'plage', 20, 'Moment'), 'flexible');
  v_message text := texte_demande(p_donnees->>'message', 2000, 'Message');
  v_annee int;
  v_date date;
begin
  if v_nom is null then
    raise exception 'Indiquez votre nom.';
  end if;
  if v_telephone is null and v_courriel is null then
    raise exception 'Indiquez un téléphone ou un courriel pour que le garage puisse vous confirmer le rendez-vous.';
  end if;
  if v_courriel is not null and v_courriel !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'L''adresse courriel semble incomplète.';
  end if;
  if v_telephone is not null and length(regexp_replace(v_telephone, '\D', '', 'g')) < 10 then
    raise exception 'Le numéro de téléphone doit compter au moins dix chiffres.';
  end if;
  if v_plage not in ('matin', 'apres_midi', 'flexible') then
    raise exception 'Moment de la journée inconnu.';
  end if;
  if v_annee_texte is not null then
    if v_annee_texte !~ '^\d{4}$' then
      raise exception 'L''année du véhicule doit compter quatre chiffres.';
    end if;
    v_annee := v_annee_texte::int;
    if v_annee < 1900 or v_annee > extract(year from current_date)::int + 2 then
      raise exception 'L''année du véhicule semble inexacte.';
    end if;
  end if;
  if v_date_texte is not null then
    begin
      v_date := v_date_texte::date;
    exception when others then
      raise exception 'La date souhaitée est invalide.';
    end;
    -- Heure de l'atelier : un client qui écrit à 21 h le 14 ne doit pas se
    -- voir refuser le 14 parce que le serveur est déjà au 15 en UTC.
    if v_date < (now() at time zone 'America/Toronto')::date or v_date > current_date + 365 then
      raise exception 'Choisissez une date à partir d''aujourd''hui, dans les douze prochains mois.';
    end if;
  end if;

  v_garage := controler_demande_publique(p_slug, 'rendez_vous');

  if exists (
    select 1 from demandes_rendez_vous
     where garage_id = v_garage and created_at > now() - interval '10 minutes'
       and lower(nom) = lower(v_nom)
       and coalesce(regexp_replace(telephone, '\D', '', 'g'), '') = coalesce(regexp_replace(v_telephone, '\D', '', 'g'), '')
       and coalesce(lower(courriel), '') = coalesce(v_courriel, '')
  ) then
    return jsonb_build_object('ok', true, 'doublon', true);
  end if;

  insert into demandes_rendez_vous (
    garage_id, nom, telephone, courriel, marque, modele, annee,
    service, date_souhaitee, plage, message, consentement_communications
  ) values (
    v_garage, v_nom, v_telephone, v_courriel, v_marque, v_modele, v_annee,
    v_service, v_date, v_plage, v_message,
    coalesce((p_donnees->>'consentement_communications')::boolean, false)
  );

  return jsonb_build_object('ok', true, 'doublon', false);
end;
$$;

revoke execute on function deposer_demande_rendez_vous(text, jsonb) from public;
grant execute on function deposer_demande_rendez_vous(text, jsonb) to anon, authenticated;


-- La purge quotidienne efface aussi les traces de plus d'un jour, pour les
-- jours sans aucune demande.
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
  delete from demandes_publiques_traces where cree_le < now() - interval '1 day';
  return jsonb_build_object('demandes_accueil', v_accueil, 'demandes_rendez_vous', v_rdv);
end;
$$;

revoke execute on function purger_demandes_publiques() from public, anon, authenticated;
grant execute on function purger_demandes_publiques() to service_role;

notify pgrst, 'reload schema';

select 'anti-spam des demandes publiques en place' as resultat;
