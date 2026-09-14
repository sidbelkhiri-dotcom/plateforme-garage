-- ============================================================
-- Migration : 2026-10-11 — inviter ses employés
--
-- Un garage inscrit seul n'avait aucun moyen d'ajouter sa réception ou
-- ses mécaniciens : la page Paramètres disait de « créer le compte dans
-- Supabase », ce qu'aucun garagiste ne peut faire. Un vrai garage restait
-- donc seul dans l'application.
--
-- LE PARCOURS
--   1. L'admin saisit nom, courriel et rôle. preparer_invitation() vérifie
--      qu'il est admin d'un garage actif et pose une ligne ici.
--   2. La route /api/inviter-employe crée le compte avec l'API
--      d'administration de Supabase (invitation) et envoie le lien par
--      courriel.
--   3. handle_new_user() voit un compte INVITÉ dont le courriel a une
--      invitation en attente : il le rattache au garage avec le rôle prévu.
--   4. À la première connexion, l'invitation passe « acceptée ».
--
-- POURQUOI invited_at ET PAS LES MÉTADONNÉES
-- Les métadonnées d'un compte (raw_user_meta_data) sont écrites par le
-- navigateur lors d'une inscription ordinaire : s'y fier permettrait à un
-- inconnu de s'inscrire avec { garage_id: …, role: "admin" }. auth.users.
-- invited_at, lui, n'est posé que par l'API d'administration, qui exige la
-- clé service. Une inscription ordinaire avec le courriel d'un employé
-- invité ne le rattache donc à rien.
-- ============================================================

create table invitations_employes (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages(id),
  courriel text not null,
  nom text not null,
  role text not null check (role in ('admin', 'reception', 'mecanicien')),
  invite_par uuid references profiles(id) on delete set null,
  utilisateur_id uuid,
  cree_le timestamptz not null default now(),
  acceptee_le timestamptz
);

-- Un compte n'appartient qu'à un garage (profiles.garage_id) : une seule
-- invitation en attente par courriel, tous garages confondus.
create unique index invitations_employes_une_en_attente
  on invitations_employes (lower(courriel)) where acceptee_le is null;
create index invitations_employes_garage on invitations_employes (garage_id);

alter table invitations_employes enable row level security;

-- Lecture : l'admin de son garage seulement. Aucune politique d'écriture :
-- création et annulation passent par les fonctions ci-dessous, qui font
-- les vérifications qu'une politique ne sait pas faire (compte existant,
-- garage actif, suppression du compte jamais utilisé).
create policy "invitations_select_admin" on invitations_employes
  for select using (garage_id = garage_actuel() and est_role('admin'));

create policy "gel_insert_garage_suspendu" on invitations_employes
  as restrictive for insert with check (garage_operationnel());
create policy "gel_update_garage_suspendu" on invitations_employes
  as restrictive for update using (garage_operationnel());
create policy "gel_delete_garage_suspendu" on invitations_employes
  as restrictive for delete using (garage_operationnel());


-- ------------------------------------------------------------
-- preparer_invitation — appelée avec la session de l'admin
-- ------------------------------------------------------------
create or replace function preparer_invitation(p_courriel text, p_nom text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_courriel text := lower(trim(p_courriel));
  v_nom text := trim(p_nom);
  v_garage uuid := garage_actuel();
  v_compte auth.users;
  v_invitation invitations_employes;
begin
  if not est_role('admin') then
    raise exception 'Seul l''administrateur du garage peut inviter un employé.';
  end if;
  if v_garage is null or not garage_operationnel() then
    raise exception 'Votre garage est suspendu : impossible d''inviter un employé pour l''instant.';
  end if;
  if v_courriel is null or v_courriel !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Adresse courriel invalide.';
  end if;
  if v_nom is null or v_nom = '' then
    raise exception 'Le nom de l''employé est obligatoire.';
  end if;
  if p_role not in ('admin', 'reception', 'mecanicien') then
    raise exception 'Rôle inconnu.';
  end if;

  select * into v_compte from auth.users where lower(email) = v_courriel limit 1;

  if v_compte.id is not null then
    -- Renvoi : le compte existe parce qu'on l'a déjà invité ici, et
    -- personne ne s'en est jamais servi. On garde la même invitation,
    -- en mettant à jour nom et rôle s'ils ont été corrigés.
    select * into v_invitation from invitations_employes
     where utilisateur_id = v_compte.id and garage_id = v_garage and acceptee_le is null;
    if v_invitation.id is not null and v_compte.last_sign_in_at is null then
      update invitations_employes set nom = v_nom, role = p_role, cree_le = now(), invite_par = auth.uid()
       where id = v_invitation.id;
      -- L'appelant est admin : protect_profile_role() laisse passer le rôle.
      update profiles set nom = v_nom, role = p_role where id = v_compte.id and garage_id = v_garage;
      return jsonb_build_object('id', v_invitation.id, 'renvoi', true);
    end if;
    -- Même message que le compte appartienne à ce garage ou à un autre :
    -- la fonction ne doit pas servir à sonder qui utilise Garagenda.
    raise exception 'Ce courriel est déjà associé à un compte Garagenda. Utilisez une autre adresse.';
  end if;

  -- Une invitation précédente de ce garage, jamais concrétisée (le compte
  -- n'a pas été créé, par exemple si l'envoi a échoué) : on la remplace.
  delete from invitations_employes
   where lower(courriel) = v_courriel and garage_id = v_garage and acceptee_le is null and utilisateur_id is null;

  if exists (select 1 from invitations_employes where lower(courriel) = v_courriel and acceptee_le is null) then
    raise exception 'Ce courriel est déjà associé à un compte Garagenda. Utilisez une autre adresse.';
  end if;

  insert into invitations_employes (garage_id, courriel, nom, role, invite_par)
  values (v_garage, v_courriel, v_nom, p_role, auth.uid())
  returning * into v_invitation;

  return jsonb_build_object('id', v_invitation.id, 'renvoi', false);
end;
$$;

revoke execute on function preparer_invitation(text, text, text) from public, anon;
grant execute on function preparer_invitation(text, text, text) to authenticated;


-- ------------------------------------------------------------
-- annuler_invitation — retire l'invitation ET le compte jamais utilisé
-- ------------------------------------------------------------
create or replace function annuler_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation invitations_employes;
begin
  if not est_role('admin') or not garage_operationnel() then
    raise exception 'Seul l''administrateur d''un garage actif peut annuler une invitation.';
  end if;

  select * into v_invitation from invitations_employes
   where id = p_invitation_id and garage_id = garage_actuel();
  if v_invitation.id is null then
    raise exception 'Invitation introuvable.';
  end if;
  if v_invitation.acceptee_le is not null then
    raise exception 'Cette personne a déjà activé son compte : désactivez-la plutôt dans la liste des utilisateurs.';
  end if;

  delete from invitations_employes where id = v_invitation.id;

  -- Le compte créé par l'invitation n'a jamais servi : sans ce ménage, il
  -- resterait rattaché au garage, prêt à s'activer avec le lien déjà envoyé.
  if v_invitation.utilisateur_id is not null then
    if exists (select 1 from auth.users where id = v_invitation.utilisateur_id and last_sign_in_at is null) then
      delete from profiles where id = v_invitation.utilisateur_id;
      delete from auth.users where id = v_invitation.utilisateur_id;
    end if;
  end if;
end;
$$;

revoke execute on function annuler_invitation(uuid) from public, anon;
grant execute on function annuler_invitation(uuid) to authenticated;


-- ------------------------------------------------------------
-- handle_new_user — rattache un compte invité à son garage
-- ------------------------------------------------------------
create or replace function handle_new_user()
returns trigger as $$
declare
  v_nom_garage text;
  v_garage_id uuid;
  v_invitation invitations_employes;
begin
  if new.invited_at is not null then
    select * into v_invitation from invitations_employes
     where lower(courriel) = lower(new.email) and acceptee_le is null and utilisateur_id is null
     order by cree_le desc limit 1;
    if v_invitation.id is not null then
      insert into public.profiles (id, nom, role, garage_id)
      values (new.id, v_invitation.nom, v_invitation.role, v_invitation.garage_id);
      update invitations_employes set utilisateur_id = new.id where id = v_invitation.id;
      return new;
    end if;
  end if;

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


-- ------------------------------------------------------------
-- Première connexion d'un invité : l'invitation est acceptée
-- ------------------------------------------------------------
create or replace function marquer_invitation_acceptee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.last_sign_in_at is not null and old.last_sign_in_at is null then
    update invitations_employes set acceptee_le = now()
     where utilisateur_id = new.id and acceptee_le is null;
  end if;
  return new;
end;
$$;

revoke execute on function marquer_invitation_acceptee() from public, anon, authenticated;

drop trigger if exists invitation_acceptee on auth.users;
create trigger invitation_acceptee
  after update of last_sign_in_at on auth.users
  for each row execute function marquer_invitation_acceptee();

notify pgrst, 'reload schema';

select 'invitations employés prêtes' as resultat;
