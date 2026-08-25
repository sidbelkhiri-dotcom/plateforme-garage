-- ============================================================
-- Migration : 2026-08-25 — inspection numérique avec approbation à distance
--
-- Premier patron d'accès public en LECTURE + ÉCRITURE d'une ressource
-- précise du projet — différent des tables d'attente à écriture seule
-- (demandes_accueil, demandes_rendez_vous). Un client anonyme, sans
-- compte, doit pouvoir consulter son inspection et approuver/refuser
-- chaque point, en connaissant seulement un jeton.
--
-- Conception relue par un second passage d'architecture avant d'écrire
-- cette migration — voir docs/ARCHITECTURE-MULTI-TENANT.md, section
-- « Fonctionnalité : inspection numérique avec approbation à distance »
-- pour le raisonnement complet (pourquoi des fonctions security definer
-- plutôt qu'une policy RLS anon directe, pourquoi expire_le/revoque sont
-- des colonnes explicites plutôt que dérivées du statut du bon, etc.).
-- À exécuter une fois dans le SQL Editor du projet Supabase de la
-- Plateforme (JAMAIS sur le projet Supabase de production MECAFORCE).
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------

create table inspections (
  id uuid primary key default gen_random_uuid(),
  bon_travail_id uuid not null references bons_travail(id) on delete cascade,
  statut text not null default 'brouillon'
    check (statut in ('brouillon', 'envoyee', 'consultee', 'repondue')),
  jeton_acces uuid not null unique default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  envoyee_le timestamptz,
  -- Source de vérité locale et explicite, jamais dérivée implicitement
  -- du statut de bons_travail (même principe que le figeage de
  -- montant_evaluation, D13) — synchronisée par trigger ci-dessous.
  expire_le timestamptz,
  revoque boolean not null default false
);
create index idx_inspections_bon_travail on inspections (bon_travail_id);
-- La recherche par jeton doit être aussi rapide qu'un index unique le
-- permet déjà (contrainte unique ci-dessus crée l'index), pas besoin
-- d'un index supplémentaire.

create table inspection_points (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references inspections(id) on delete cascade,
  description text not null,
  etat text not null check (etat in ('bon', 'a_surveiller', 'a_reparer')),
  recommandation text,
  prix_estime numeric(10,2),
  decision_client text check (decision_client in ('approuve', 'refuse')),
  repondu_le timestamptz,
  ordre int not null default 0
);
create index idx_inspection_points_inspection on inspection_points (inspection_id, ordre);

create table inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_point_id uuid not null references inspection_points(id) on delete cascade,
  -- Distinct du jeton d'accès de l'inspection — la fuite d'une seule
  -- photo (ex. un scanner de courriel d'entreprise qui précharge les
  -- images) ne doit jamais exposer le jeton qui donne accès et droit
  -- de réponse à toute l'inspection.
  identifiant_public uuid not null unique default gen_random_uuid(),
  type text not null check (type in ('photo', 'video')),
  cree_le timestamptz not null default now()
);
create index idx_inspection_photos_point on inspection_photos (inspection_point_id);

alter table inspections enable row level security;
alter table inspection_points enable row level security;
alter table inspection_photos enable row level security;

-- ------------------------------------------------------------
-- Accès du personnel (authentifié, par rôle) — création et suivi de
-- l'inspection. Aucune policy pour anon sur ces trois tables : la
-- défense en profondeur veut que si une future migration expose ces
-- tables par erreur, RLS bloque par défaut (même raisonnement déjà
-- appliqué à facture_lignes).
-- ------------------------------------------------------------

create policy "inspections_staff_all" on inspections
  for all using (est_role('admin', 'reception', 'mecanicien'))
  with check (est_role('admin', 'reception', 'mecanicien'));

create policy "inspection_points_staff_all" on inspection_points
  for all using (est_role('admin', 'reception', 'mecanicien'))
  with check (est_role('admin', 'reception', 'mecanicien'));

create policy "inspection_photos_staff_all" on inspection_photos
  for all using (est_role('admin', 'reception', 'mecanicien'))
  with check (est_role('admin', 'reception', 'mecanicien'));

-- ------------------------------------------------------------
-- Accès public : uniquement par ces deux fonctions. Jamais de policy
-- RLS anon directe — une policy using (jeton_acces = ...) suppose un
-- JWT signé par inspection (donc une fonction serveur pour l'émettre,
-- le problème déplacé, pas résolu), oblige à dupliquer la logique de
-- validité sur 3 tables via des sous-select, et ne peut pas restreindre
-- une écriture à une seule colonne sans grants au niveau colonne.
-- ------------------------------------------------------------

create or replace function obtenir_inspection_publique(p_jeton uuid)
returns jsonb as $$
declare
  v_inspection inspections%rowtype;
  v_resultat jsonb;
begin
  select * into v_inspection from inspections where jeton_acces = p_jeton;

  -- Message générique unique, que le jeton soit inexistant, expiré ou
  -- révoqué — sinon la fonction devient un oracle d'énumération pour
  -- un attaquant qui teste des jetons, même si le jeton lui-même reste
  -- infaisable à deviner par force brute.
  if v_inspection.id is null
     or v_inspection.revoque
     or (v_inspection.expire_le is not null and v_inspection.expire_le < now())
  then
    raise exception 'Inspection introuvable ou lien expiré.';
  end if;

  if v_inspection.statut = 'envoyee' then
    update inspections set statut = 'consultee' where id = v_inspection.id;
  end if;

  select jsonb_build_object(
    'inspection', jsonb_build_object(
      'id', v_inspection.id,
      'statut', v_inspection.statut,
      'envoyee_le', v_inspection.envoyee_le
    ),
    'points', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'description', p.description,
        'etat', p.etat,
        'recommandation', p.recommandation,
        'prix_estime', p.prix_estime,
        'decision_client', p.decision_client,
        'photos', (
          select coalesce(jsonb_agg(
            jsonb_build_object('identifiant_public', ph.identifiant_public, 'type', ph.type)
            order by ph.cree_le
          ), '[]'::jsonb)
          from inspection_photos ph where ph.inspection_point_id = p.id
        )
      ) order by p.ordre
    ) filter (where p.id is not null), '[]'::jsonb)
  )
  into v_resultat
  from inspection_points p
  where p.inspection_id = v_inspection.id;

  return v_resultat;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function repondre_inspection_point(p_jeton uuid, p_point_id uuid, p_decision text)
returns void as $$
declare
  v_inspection inspections%rowtype;
  v_point_existe boolean;
begin
  if p_decision not in ('approuve', 'refuse') then
    raise exception 'Décision invalide.';
  end if;

  select * into v_inspection from inspections where jeton_acces = p_jeton;

  if v_inspection.id is null
     or v_inspection.revoque
     or (v_inspection.expire_le is not null and v_inspection.expire_le < now())
  then
    raise exception 'Inspection introuvable ou lien expiré.';
  end if;

  select exists(
    select 1 from inspection_points where id = p_point_id and inspection_id = v_inspection.id
  ) into v_point_existe;

  if not v_point_existe then
    raise exception 'Inspection introuvable ou lien expiré.';
  end if;

  update inspection_points
  set decision_client = p_decision, repondu_le = now()
  where id = p_point_id;

  update inspections set statut = 'repondue' where id = v_inspection.id and statut <> 'repondue';
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Par défaut Supabase donne EXECUTE à anon/authenticated sur toute
-- nouvelle fonction du schéma public — le revoke/grant explicite n'est
-- pas optionnel (même oubli déjà corrigé pour reevaluer_bon() le 25
-- août sur le projet MECAFORCE).
revoke all on function obtenir_inspection_publique(uuid) from public;
grant execute on function obtenir_inspection_publique(uuid) to anon, authenticated;

revoke all on function repondre_inspection_point(uuid, uuid, text) from public;
grant execute on function repondre_inspection_point(uuid, uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Synchronisation automatique de la révocation avec le statut du bon
-- de travail — en complément des colonnes explicites, pas en
-- remplacement (même esprit que proteger_autorisation_bon).
-- ------------------------------------------------------------

create or replace function revoquer_inspections_bon()
returns trigger as $$
begin
  if new.statut in ('facture', 'annule') and old.statut is distinct from new.statut then
    update inspections set revoque = true where bon_travail_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger revoquer_inspections_bon_trigger
  after update on bons_travail
  for each row execute function revoquer_inspections_bon();

-- ------------------------------------------------------------
-- Temps réel : le personnel voit la décision du client apparaître en
-- direct, comme pour demandes_rendez_vous.
-- ------------------------------------------------------------

alter publication supabase_realtime add table inspection_points;

-- ------------------------------------------------------------
-- Vérifications après exécution (à décommenter et exécuter)
-- ------------------------------------------------------------

-- -- Doit renvoyer 0 ligne : aucune policy anon sur les 3 tables
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('inspections', 'inspection_points', 'inspection_photos')
--   and roles @> array['anon']::name[];

-- -- Doit renvoyer exactement les deux fonctions publiques attendues
-- select proname from pg_proc
-- where has_function_privilege('anon', oid, 'execute')
--   and proname in ('obtenir_inspection_publique', 'repondre_inspection_point');
