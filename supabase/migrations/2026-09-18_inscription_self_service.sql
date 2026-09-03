-- ============================================================
-- Migration : 2026-09-18 — inscription self-service
--
-- Jusqu'ici, le seul moyen de créer un garage était une intervention SQL
-- manuelle. handle_new_user() sait maintenant créer, en un seul geste
-- atomique déclenché par l'inscription, le garage + ses paramètres par
-- défaut + le profil admin qui le possède — à condition que l'inscription
-- passe `nom_garage` dans les métadonnées (supabase.auth.signUp({
-- options: { data: { nom, nom_garage } } })).
--
-- La création manuelle d'utilisateur depuis le dashboard Supabase (ou tout
-- signUp sans nom_garage) garde son comportement d'origine : un profil nu,
-- sans garage, rôle mecanicien par défaut — rien ne casse pour les comptes
-- déjà provisionnés ainsi.
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
declare
  v_nom_garage text;
  v_garage_id uuid;
begin
  v_nom_garage := trim(new.raw_user_meta_data->>'nom_garage');

  if v_nom_garage is not null and v_nom_garage <> '' then
    insert into garages (nom) values (v_nom_garage) returning id into v_garage_id;
    insert into parametres (garage_id, nom) values (v_garage_id, v_nom_garage);
    insert into public.profiles (id, nom, role, garage_id)
    values (new.id, coalesce(new.raw_user_meta_data->>'nom', new.email), 'admin', v_garage_id);
  else
    insert into public.profiles (id, nom)
    values (new.id, coalesce(new.raw_user_meta_data->>'nom', new.email));
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
