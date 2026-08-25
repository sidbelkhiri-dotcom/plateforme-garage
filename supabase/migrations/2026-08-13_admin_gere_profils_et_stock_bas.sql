-- ============================================================
-- Migration : 2026-08-13 — l'admin peut gérer les profils + stock bas en SQL
-- Lot 8 (inventaire et paramètres). Voir DESIGN.md journal, D27.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

-- D27 (trouvé en préparant le Lot 8) : sans cette policy, personne ne peut
-- changer le rôle ou désactiver le compte de quelqu'un d'autre — même un
-- admin. profiles_update_self limite toute écriture à auth.uid() = id.
-- L'écran d'assignation des rôles (8.5) ne peut pas fonctionner sans ça.
create policy "admin_gere_les_profils" on profiles
  for update using (est_role('admin')) with check (est_role('admin'));

-- 8.2 : stock bas calculé en SQL, jamais en JavaScript après chargement
-- complet de la table.
alter table inventaire
  add column stock_bas boolean generated always as (quantite <= seuil) stored;
