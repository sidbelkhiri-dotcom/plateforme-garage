-- ============================================================
-- Migration : 2026-08-17 — photos sur les véhicules en stock
-- Permet un vrai listing visuel dans /vehicules-stock : plusieurs photos
-- par véhicule, stockées dans un bucket Supabase Storage dédié. Chemins
-- (pas les URLs complètes) stockés dans `photos`, reconstruits à
-- l'affichage via getPublicUrl() — plus robuste si le bucket ou le
-- domaine change un jour.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table vehicules_stock add column photos text[] not null default '{}';

-- Bucket public en lecture : ce sont des photos de véhicules à vendre,
-- aucune donnée sensible — permet d'afficher <img src=...> directement
-- sans URL signée. Écriture réservée admin/reception, même politique que
-- la table vehicules_stock elle-même.
insert into storage.buckets (id, name, public)
values ('vehicules-stock', 'vehicules-stock', true)
on conflict (id) do nothing;

create policy "vehicules_stock_photos_select" on storage.objects
  for select using (bucket_id = 'vehicules-stock');
create policy "vehicules_stock_photos_insert" on storage.objects
  for insert with check (bucket_id = 'vehicules-stock' and est_role('admin', 'reception'));
create policy "vehicules_stock_photos_delete" on storage.objects
  for delete using (bucket_id = 'vehicules-stock' and est_role('admin', 'reception'));
