-- ============================================================
-- Migration : 2026-09-05 — écriture scopée par garage (étape 4/6, partie 1)
--
-- Deux volets :
--   1. garage_id reçoit une valeur par défaut (garage_actuel()) sur les
--      tables racines — le code applicatif n'envoie jamais garage_id
--      explicitement, donc sans ce défaut, plus aucun insert ne
--      passerait la contrainte not null posée à l'étape 2.
--   2. Les policies insert/update/delete, qui ne vérifiaient jusqu'ici
--      que le rôle (est_role()), vérifient maintenant aussi le garage —
--      sans ça, un admin du garage A pouvait modifier une ligne du
--      garage B du moment qu'il en connaissait l'id.
--
-- Restent hors de cette migration (partie 2 à venir) : les fonctions
-- security definer (creer_facture, annuler_facture, accepter_evaluation,
-- reevaluer_bon, enregistrer_paiement) — elles contournent la RLS par
-- nature, leur garde-fou doit être ajouté dans leur propre code SQL, pas
-- via une policy.
-- ============================================================

alter table clients alter column garage_id set default garage_actuel();
alter table vehicules alter column garage_id set default garage_actuel();
alter table rendez_vous alter column garage_id set default garage_actuel();
alter table inventaire alter column garage_id set default garage_actuel();
alter table bons_travail alter column garage_id set default garage_actuel();
alter table factures alter column garage_id set default garage_actuel();
alter table vehicules_stock alter column garage_id set default garage_actuel();

-- clients
drop policy "clients_insert_admin_reception" on clients;
create policy "clients_insert_admin_reception" on clients
  for insert with check (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "clients_update_admin_reception" on clients;
create policy "clients_update_admin_reception" on clients
  for update using (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "clients_delete_admin" on clients;
create policy "clients_delete_admin" on clients
  for delete using (est_role('admin') and garage_id = garage_actuel());

-- vehicules
drop policy "vehicules_insert_admin_reception" on vehicules;
create policy "vehicules_insert_admin_reception" on vehicules
  for insert with check (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "vehicules_update_admin_reception" on vehicules;
create policy "vehicules_update_admin_reception" on vehicules
  for update using (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "vehicules_delete_admin" on vehicules;
create policy "vehicules_delete_admin" on vehicules
  for delete using (est_role('admin') and garage_id = garage_actuel());

-- rendez_vous
drop policy "rdv_insert_admin_reception" on rendez_vous;
create policy "rdv_insert_admin_reception" on rendez_vous
  for insert with check (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "rdv_update_admin_reception" on rendez_vous;
create policy "rdv_update_admin_reception" on rendez_vous
  for update using (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "rdv_delete_admin" on rendez_vous;
create policy "rdv_delete_admin" on rendez_vous
  for delete using (est_role('admin') and garage_id = garage_actuel());

-- inventaire
drop policy "inventaire_write_admin_reception" on inventaire;
create policy "inventaire_write_admin_reception" on inventaire
  for all using (est_role('admin', 'reception') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception') and garage_id = garage_actuel());

-- bons_travail
drop policy "bt_insert_admin_reception" on bons_travail;
create policy "bt_insert_admin_reception" on bons_travail
  for insert with check (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "bt_update_admin_reception_ou_assigne" on bons_travail;
create policy "bt_update_admin_reception_ou_assigne" on bons_travail
  for update using (
    garage_id = garage_actuel()
    and (est_role('admin', 'reception') or employe_id = auth.uid())
  );
drop policy "bt_delete_admin" on bons_travail;
create policy "bt_delete_admin" on bons_travail
  for delete using (est_role('admin') and garage_id = garage_actuel());

-- bon_travail_lignes (garage_id posé par trigger depuis le parent, voir
-- étape 2 — vérifié ici en plus, jamais fourni par le client)
drop policy "bt_lignes_write_autorise" on bon_travail_lignes;
create policy "bt_lignes_write_autorise" on bon_travail_lignes
  for all using (
    garage_id = garage_actuel()
    and exists (
      select 1 from bons_travail bt
      where bt.id = bon_travail_id
        and (est_role('admin', 'reception') or bt.employe_id = auth.uid())
    )
  )
  with check (
    garage_id = garage_actuel()
    and exists (
      select 1 from bons_travail bt
      where bt.id = bon_travail_id
        and (est_role('admin', 'reception') or bt.employe_id = auth.uid())
    )
  );

-- factures (pas de policy delete depuis le 2026-08-23 — inchangé ici)
drop policy "factures_insert_admin_reception" on factures;
create policy "factures_insert_admin_reception" on factures
  for insert with check (est_role('admin', 'reception') and garage_id = garage_actuel());
drop policy "factures_update_admin_reception" on factures;
create policy "factures_update_admin_reception" on factures
  for update using (est_role('admin', 'reception') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception') and garage_id = garage_actuel());

-- vehicules_stock
drop policy "vehicules_stock_write_admin_reception" on vehicules_stock;
create policy "vehicules_stock_write_admin_reception" on vehicules_stock
  for all using (est_role('admin', 'reception') and garage_id = garage_actuel())
  with check (est_role('admin', 'reception') and garage_id = garage_actuel());
