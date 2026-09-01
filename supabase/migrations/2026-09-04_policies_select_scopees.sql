-- ============================================================
-- Migration : 2026-09-04 — scoper les 11 policies SELECT ouvertes (étape 3/6)
--
-- Sur les 14 policies `auth.role() = 'authenticated'` repérées par
-- l'audit d'architecture, 2 restent volontairement inchangées ici :
--   - ref_vehicule_ymm, ref_pieces : catalogues partagés (données NHTSA /
--     liste générique de pièces), identiques pour tous les garages —
--     les scoper n'apporterait aucune sécurité et casserait l'UX.
-- Et 1 est reportée :
--   - parametres : encore une ligne unique (id=1) partagée par toute
--     l'app. La restructurer (une ligne par garage) demande de changer
--     le code applicatif en même temps — traité à part.
--
-- Reste hors de cette migration (délibérément) : les policies d'écriture
-- (insert/update/delete) qui utilisent déjà est_role() seul, sans
-- garage_id — un admin du garage A pourrait donc encore modifier une
-- ligne du garage B. C'est un vrai trou, mais un risque moindre qu'une
-- fuite en lecture (le plan le traite dans une étape séparée, avec les
-- fonctions security definer critiques).
-- ============================================================

-- profiles.garage_id n'a jamais été peuplé (volontairement laissé
-- nullable à l'étape 1) — sans ce backfill, garage_actuel() renverrait
-- null pour tout le monde et plus personne ne pourrait lire son propre
-- profil, cassant la connexion.
update profiles set garage_id = (select id from garages where nom = 'Atelier pilote (développement)')
  where garage_id is null;

drop policy "profiles_select_all" on profiles;
create policy "profiles_select_all" on profiles
  for select using (garage_id = garage_actuel());

drop policy "clients_select_all" on clients;
create policy "clients_select_all" on clients
  for select using (garage_id = garage_actuel());

drop policy "vehicules_select_all" on vehicules;
create policy "vehicules_select_all" on vehicules
  for select using (garage_id = garage_actuel());

drop policy "rdv_select_all" on rendez_vous;
create policy "rdv_select_all" on rendez_vous
  for select using (garage_id = garage_actuel());

drop policy "inventaire_select_all" on inventaire;
create policy "inventaire_select_all" on inventaire
  for select using (garage_id = garage_actuel());

drop policy "bt_select_all" on bons_travail;
create policy "bt_select_all" on bons_travail
  for select using (garage_id = garage_actuel());

drop policy "bt_lignes_select_all" on bon_travail_lignes;
create policy "bt_lignes_select_all" on bon_travail_lignes
  for select using (garage_id = garage_actuel());

drop policy "factures_select_all" on factures;
create policy "factures_select_all" on factures
  for select using (garage_id = garage_actuel());

drop policy "facture_lignes_select_all" on facture_lignes;
create policy "facture_lignes_select_all" on facture_lignes
  for select using (garage_id = garage_actuel());

drop policy "bt_evaluations_select_all" on bon_travail_evaluations;
create policy "bt_evaluations_select_all" on bon_travail_evaluations
  for select using (garage_id = garage_actuel());

drop policy "vehicules_stock_select_all" on vehicules_stock;
create policy "vehicules_stock_select_all" on vehicules_stock
  for select using (garage_id = garage_actuel());
