-- ============================================================
-- Migration : 2026-09-26 — cloisonner demandes_accueil/demandes_rendez_vous
--
-- Ces deux tables ont été explicitement laissées de côté lors de la
-- conversion multi-tenant (voir commentaire de 2026-09-02 : "formulaires
-- publics et fonctionnalité distincte, explicitement Phase 2+ du plan").
-- Leurs seules policies SELECT/UPDATE/DELETE sont scopées par rôle
-- (est_role) mais jamais par garage — n'importe quel admin/reception
-- voyait, modifiait et supprimait les demandes de TOUS les garages.
-- Aucune donnée existante dans les deux tables (vérifié avant d'écrire
-- cette migration) — pas de backfill nécessaire.
--
-- En profite pour poser garages.slug, nécessaire pour qu'un formulaire
-- public sache à quel garage il s'adresse (ex. /accueil/mecaforce-service)
-- — première brique du site public par garage à venir.
-- ============================================================

-- ------------------------------------------------------------
-- garages.slug — généré automatiquement à partir du nom, jamais fourni
-- par le client. Unique, avec suffixe numérique en cas de collision.
-- ------------------------------------------------------------

alter table garages add column slug text;

create or replace function generer_slug_garage()
returns trigger as $$
declare
  v_base text;
  v_slug text;
  v_compteur int := 0;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  v_base := lower(regexp_replace(new.nom, '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'garage';
  end if;
  v_slug := v_base;
  while exists (select 1 from garages where slug = v_slug and id <> new.id) loop
    v_compteur := v_compteur + 1;
    v_slug := v_base || '-' || v_compteur;
  end loop;
  new.slug := v_slug;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger garages_generer_slug
  before insert on garages
  for each row execute function generer_slug_garage();

-- Backfill des garages existants (le trigger ne s'applique qu'aux futurs
-- inserts) — même logique que generer_slug_garage(), en boucle simple
-- puisqu'il n'y a que quelques garages de test à ce stade.
do $$
declare
  v_garage record;
  v_base text;
  v_slug text;
  v_n int;
begin
  for v_garage in select id, nom from garages where slug is null order by cree_le loop
    v_base := trim(both '-' from lower(regexp_replace(v_garage.nom, '[^a-zA-Z0-9]+', '-', 'g')));
    if v_base = '' then
      v_base := 'garage';
    end if;
    v_slug := v_base;
    v_n := 0;
    while exists (select 1 from garages where slug = v_slug) loop
      v_n := v_n + 1;
      v_slug := v_base || '-' || v_n;
    end loop;
    update garages set slug = v_slug where id = v_garage.id;
  end loop;
end $$;

alter table garages alter column slug set not null;
alter table garages add constraint garages_slug_uniq unique (slug);

-- ------------------------------------------------------------
-- Accès public à un garage par son slug — jamais une lecture directe de
-- `garages` (qui contient stripe_customer_id, abonnement_statut, etc.),
-- une fonction security definer ne renvoie que le strict nécessaire.
-- Même philosophie que obtenir_inspection_publique().
-- ------------------------------------------------------------

create or replace function obtenir_garage_public(p_slug text)
returns jsonb as $$
  select jsonb_build_object('id', id, 'nom', nom, 'adresse', adresse, 'telephone', telephone)
  from garages where slug = p_slug and statut = 'actif';
$$ language sql stable security definer set search_path = public, pg_temp;

revoke all on function obtenir_garage_public(text) from public;
grant execute on function obtenir_garage_public(text) to anon, authenticated;

-- ------------------------------------------------------------
-- demandes_accueil — cloisonnement par garage
-- ------------------------------------------------------------

alter table demandes_accueil add column garage_id uuid not null references garages(id);

drop policy "demandes_accueil_select_staff" on demandes_accueil;
create policy "demandes_accueil_select_staff" on demandes_accueil
  for select using (est_role('admin', 'reception') and garage_id = garage_actuel());

drop policy "demandes_accueil_update_staff" on demandes_accueil;
create policy "demandes_accueil_update_staff" on demandes_accueil
  for update using (est_role('admin', 'reception') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception') and garage_id = garage_actuel());

drop policy "demandes_accueil_delete_staff" on demandes_accueil;
create policy "demandes_accueil_delete_staff" on demandes_accueil
  for delete using (est_role('admin', 'reception') and garage_id = garage_actuel());

-- Écriture publique inchangée dans son principe (voir migration
-- d'origine) : n'importe qui peut insérer, le pire cas est une ligne à
-- ignorer. garage_id doit simplement pointer vers un garage réel.
drop policy "demandes_accueil_insert_public" on demandes_accueil;
create policy "demandes_accueil_insert_public" on demandes_accueil
  for insert with check (garage_id is not null);

-- ------------------------------------------------------------
-- demandes_rendez_vous — même traitement
-- ------------------------------------------------------------

alter table demandes_rendez_vous add column garage_id uuid not null references garages(id);

drop policy "demandes_rdv_select_staff" on demandes_rendez_vous;
create policy "demandes_rdv_select_staff" on demandes_rendez_vous
  for select using (est_role('admin', 'reception') and garage_id = garage_actuel());

drop policy "demandes_rdv_update_staff" on demandes_rendez_vous;
create policy "demandes_rdv_update_staff" on demandes_rendez_vous
  for update using (est_role('admin', 'reception') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception') and garage_id = garage_actuel());

drop policy "demandes_rdv_delete_staff" on demandes_rendez_vous;
create policy "demandes_rdv_delete_staff" on demandes_rendez_vous
  for delete using (est_role('admin', 'reception') and garage_id = garage_actuel());

drop policy "demandes_rdv_insert_public" on demandes_rendez_vous;
create policy "demandes_rdv_insert_public" on demandes_rendez_vous
  for insert with check (garage_id is not null);
