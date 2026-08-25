-- ============================================================
-- Migration : 2026-08-25 — désactiver un compte doit vraiment le priver
-- de ses droits (audit du 18 août, point 15)
--
-- profiles.actif n'était consulté par aucune policy ni par est_role() —
-- uniquement utilisé pour filtrer des menus déroulants côté écran. Un
-- employé congédié gardait tous ses accès en base, et pouvait même se
-- remettre actif = true lui-même (profiles_update_self autorise l'écriture
-- de sa propre ligne ; seul `role` était protégé par un trigger).
--
-- Deux correctifs :
--   1. est_role() renvoie false pour un compte inactif, quel que soit son
--      rôle — presque toutes les policies RLS de l'application en
--      dépendent, donc ça coupe l'accès en écriture partout d'un coup.
--   2. Le trigger qui protège `role` protège maintenant `actif` aussi :
--      seul un admin peut le changer, jamais l'utilisateur lui-même.
--
-- Le blocage à la connexion (middleware) est traité séparément côté
-- application — ceci est le verrou réel, l'autre n'est qu'un confort
-- d'affichage.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create or replace function est_role(variadic roles text[])
returns boolean as $$
  select coalesce(
    (select role from profiles where id = auth.uid() and actif) = any(roles),
    false
  );
$$ language sql stable security definer;

create or replace function protect_profile_role()
returns trigger as $$
begin
  if new.role <> old.role and not est_role('admin') then
    new.role := old.role;
  end if;
  if new.actif <> old.actif and not est_role('admin') then
    new.actif := old.actif;
  end if;
  return new;
end;
$$ language plpgsql security definer;
