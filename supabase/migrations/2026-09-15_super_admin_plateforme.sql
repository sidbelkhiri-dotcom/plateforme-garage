-- ============================================================
-- Migration : 2026-09-15 — super-admin plateforme
--
-- Table séparée de profiles.role (qui reste admin|reception|mecanicien,
-- scopé à un garage) : un super-admin gère TOUS les garages, ce n'est
-- pas un rôle de garage. Aucune policy dessus — seule
-- est_admin_plateforme() (security definer) peut la lire, jamais
-- directement via l'API.
-- ============================================================

create table plateforme_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table plateforme_admins enable row level security;

create or replace function est_admin_plateforme()
returns boolean as $$
  select exists(select 1 from plateforme_admins where user_id = auth.uid());
$$ language sql stable security definer set search_path = public, pg_temp;

revoke execute on function est_admin_plateforme() from public;
grant execute on function est_admin_plateforme() to authenticated;

-- Le super-admin peut voir tous les garages (en plus du sien propre, le
-- cas échéant) ; lui seul peut en changer le statut (actif/suspendu/
-- résilié). La création d'un garage reste manuelle en SQL pour l'instant
-- (onboarding self-service = étape ultérieure du plan).
drop policy "garages_select_membre" on garages;
create policy "garages_select_membre" on garages
  for select using (id = garage_actuel() or est_admin_plateforme());

create policy "garages_update_admin_plateforme" on garages
  for update using (est_admin_plateforme()) with check (est_admin_plateforme());

-- Compte de test A (sidbelkhiri02@gmail.com) devient aussi le
-- super-admin de la plateforme — à changer plus tard pour ton vrai
-- compte de production si besoin.
insert into plateforme_admins (user_id) values ('a142251e-9258-41fa-aac5-477c46019b59');
