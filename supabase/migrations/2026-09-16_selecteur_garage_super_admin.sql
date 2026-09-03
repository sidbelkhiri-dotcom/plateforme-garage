-- ============================================================
-- Migration : 2026-09-16 — sélecteur de garage pour le super-admin
--
-- garage_actuel() ne renvoyait jusqu'ici que le garage assigné au
-- profil de l'utilisateur — même un super-admin restait coincé sur son
-- propre garage pour tout sauf la liste /admin/garages (dont la policy
-- vérifie explicitement est_admin_plateforme()). Ajoute une colonne de
-- "garage actuellement consulté", que seul un super-admin peut définir
-- sur lui-même, et que garage_actuel() préfère quand elle est posée.
-- ============================================================

alter table plateforme_admins add column garage_selectionne uuid references garages(id);

-- Un super-admin peut lire/modifier sa propre ligne (pas celle des
-- autres) — ne permet ni de s'auto-nommer super-admin (pas de policy
-- insert) ni de changer à qui appartient la ligne (with check bloque
-- toute tentative de réassigner user_id à quelqu'un d'autre).
create policy "plateforme_admins_select_soi_meme" on plateforme_admins
  for select using (user_id = auth.uid());
create policy "plateforme_admins_update_soi_meme" on plateforme_admins
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function garage_actuel()
returns uuid as $$
  select coalesce(
    (select garage_selectionne from plateforme_admins where user_id = auth.uid() and garage_selectionne is not null),
    (select garage_id from profiles where id = auth.uid())
  );
$$ language sql stable security definer set search_path = public, pg_temp;
