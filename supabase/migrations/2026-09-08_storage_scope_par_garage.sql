-- ============================================================
-- Migration : 2026-09-08 — Storage scopé par garage (étape 6/6, fin)
--
-- Les deux buckets (vehicules-stock, factures-pieces) acceptaient des
-- chemins plats, sans préfixe — RLS protège une table, pas un bucket
-- Storage par nature. Le code applicatif préfixe maintenant chaque
-- chemin par garage_id à l'upload (voir FormulaireVehiculeStock.tsx et
-- FormulaireLigneBon.tsx) ; cette migration fait respecter ce préfixe
-- côté serveur, sinon rien n'empêchait un chemin construit à la main.
--
-- Lecture de vehicules-stock volontairement INCHANGÉE : bucket public
-- (photos de véhicules à vendre, aucune donnée sensible), getPublicUrl()
-- ne passe de toute façon pas par ces policies.
-- ============================================================

drop policy "vehicules_stock_photos_insert" on storage.objects;
create policy "vehicules_stock_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'vehicules-stock'
    and est_role('admin', 'reception')
    and (storage.foldername(name))[1] = garage_actuel()::text
  );

drop policy "vehicules_stock_photos_delete" on storage.objects;
create policy "vehicules_stock_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'vehicules-stock'
    and est_role('admin', 'reception')
    and (storage.foldername(name))[1] = garage_actuel()::text
  );

-- factures-pieces est un bucket privé (URLs signées) : la lecture passe
-- réellement par cette policy, contrairement à vehicules-stock.
drop policy "factures_pieces_select" on storage.objects;
create policy "factures_pieces_select" on storage.objects
  for select using (
    bucket_id = 'factures-pieces'
    and (storage.foldername(name))[1] = garage_actuel()::text
  );

drop policy "factures_pieces_insert" on storage.objects;
create policy "factures_pieces_insert" on storage.objects
  for insert with check (
    bucket_id = 'factures-pieces'
    and (storage.foldername(name))[1] = garage_actuel()::text
  );

drop policy "factures_pieces_delete" on storage.objects;
create policy "factures_pieces_delete" on storage.objects
  for delete using (
    bucket_id = 'factures-pieces'
    and (storage.foldername(name))[1] = garage_actuel()::text
  );
