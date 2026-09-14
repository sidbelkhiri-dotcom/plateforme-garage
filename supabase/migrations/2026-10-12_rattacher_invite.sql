-- ============================================================
-- Migration : 2026-10-12 — rattacher l'invité quand il devient invité
--
-- La migration de la veille rattachait l'invité dans handle_new_user(),
-- à l'INSERT dans auth.users, en se fiant à invited_at. La suite
-- d'isolation l'a mesuré : l'API d'invitation de Supabase crée d'abord le
-- compte (invited_at vide), puis pose invited_at par un UPDATE. À l'insert,
-- le compte n'est pas encore un invité : il recevait un profil sans garage
-- et l'invitation restait orpheline.
--
-- Le rattachement se fait donc au moment où invited_at passe de vide à
-- rempli. Le principe de sécurité ne change pas : invited_at n'est posé
-- que par l'API d'administration (clé service), jamais par une inscription
-- ordinaire.
--
-- Le profil est remplacé plutôt que modifié : sans session (auth.uid()
-- vide), protect_profile_role() annulerait en silence le changement de
-- rôle — le piège déjà documenté dans scripts/isolation.mjs. Le
-- remplacement ne vise qu'un profil encore sans garage, donc neuf.
-- ============================================================

create or replace function rattacher_invite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation invitations_employes;
begin
  if old.invited_at is not null or new.invited_at is null then
    return new;
  end if;

  select * into v_invitation from invitations_employes
   where lower(courriel) = lower(new.email) and acceptee_le is null and utilisateur_id is null
   order by cree_le desc limit 1;
  if v_invitation.id is null then
    return new;
  end if;

  if exists (select 1 from profiles where id = new.id and garage_id is not null) then
    return new;
  end if;

  delete from profiles where id = new.id;
  insert into profiles (id, nom, role, garage_id)
  values (new.id, v_invitation.nom, v_invitation.role, v_invitation.garage_id);
  update invitations_employes set utilisateur_id = new.id where id = v_invitation.id;

  return new;
end;
$$;

revoke execute on function rattacher_invite() from public, anon, authenticated;

drop trigger if exists invite_rattache on auth.users;
create trigger invite_rattache
  after update of invited_at on auth.users
  for each row execute function rattacher_invite();

select 'rattachement des invités corrigé' as resultat;
