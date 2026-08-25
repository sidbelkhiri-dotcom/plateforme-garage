-- ============================================================
-- Migration : 2026-08-21 — photo de facture fournisseur sur une pièce
-- Permet de garder la preuve d'achat (fournisseur + photo de la facture
-- papier) sur chaque ligne de pièce d'un bon de travail, pour les
-- réclamations de garantie auprès du fournisseur. Bucket privé (pas
-- public comme vehicules-stock) : ce sont des documents d'achat internes,
-- accessibles seulement au personnel connecté via URL signée.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table bon_travail_lignes add column fournisseur text;
alter table bon_travail_lignes add column photos_facture text[] not null default '{}';

insert into storage.buckets (id, name, public)
values ('factures-pieces', 'factures-pieces', false)
on conflict (id) do nothing;

create policy "factures_pieces_select" on storage.objects
  for select using (bucket_id = 'factures-pieces' and auth.uid() is not null);
create policy "factures_pieces_insert" on storage.objects
  for insert with check (bucket_id = 'factures-pieces' and auth.uid() is not null);
create policy "factures_pieces_delete" on storage.objects
  for delete using (bucket_id = 'factures-pieces' and auth.uid() is not null);
