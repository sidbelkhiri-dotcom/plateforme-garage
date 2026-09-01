-- ============================================================
-- Migration : 2026-09-03 — FK composites garage_id (suite de l'étape 2/6)
--
-- Sans ça, RLS protège la lecture/écriture d'une table mais pas la
-- cohérence tenant d'une clé étrangère vers une autre : une ligne pourrait
-- référencer un id d'un autre garage sans qu'aucune contrainte ne
-- l'empêche. Fait maintenant, à un seul tenant, donc sans risque de
-- rupture de données (toutes les lignes partagent déjà le même
-- garage_id).
--
-- Note sur ON DELETE SET NULL (colonne) : sans préciser la colonne, un FK
-- composite nullifie TOUTES ses colonnes à la suppression du parent — ça
-- aurait mis garage_id à null sur des tables où il est `not null`,
-- provoquant une erreur à chaque suppression au lieu du comportement
-- attendu. Nécessite Postgres 15+.
-- ============================================================

alter table clients add constraint clients_id_garage_uniq unique (id, garage_id);
alter table vehicules add constraint vehicules_id_garage_uniq unique (id, garage_id);
alter table rendez_vous add constraint rendez_vous_id_garage_uniq unique (id, garage_id);
alter table bons_travail add constraint bons_travail_id_garage_uniq unique (id, garage_id);
alter table inventaire add constraint inventaire_id_garage_uniq unique (id, garage_id);

alter table vehicules drop constraint vehicules_client_id_fkey;
alter table vehicules add constraint vehicules_client_id_garage_fkey
  foreign key (client_id, garage_id) references clients (id, garage_id) on delete cascade;

alter table rendez_vous drop constraint rendez_vous_client_id_fkey;
alter table rendez_vous add constraint rendez_vous_client_id_garage_fkey
  foreign key (client_id, garage_id) references clients (id, garage_id) on delete set null (client_id);

alter table rendez_vous drop constraint rendez_vous_vehicule_id_fkey;
alter table rendez_vous add constraint rendez_vous_vehicule_id_garage_fkey
  foreign key (vehicule_id, garage_id) references vehicules (id, garage_id) on delete set null (vehicule_id);

alter table bons_travail drop constraint bons_travail_client_id_fkey;
alter table bons_travail add constraint bons_travail_client_id_garage_fkey
  foreign key (client_id, garage_id) references clients (id, garage_id) on delete set null (client_id);

alter table bons_travail drop constraint bons_travail_vehicule_id_fkey;
alter table bons_travail add constraint bons_travail_vehicule_id_garage_fkey
  foreign key (vehicule_id, garage_id) references vehicules (id, garage_id) on delete set null (vehicule_id);

alter table bons_travail drop constraint bons_travail_rendez_vous_id_fkey;
alter table bons_travail add constraint bons_travail_rendez_vous_id_garage_fkey
  foreign key (rendez_vous_id, garage_id) references rendez_vous (id, garage_id) on delete set null (rendez_vous_id);

alter table bon_travail_lignes drop constraint bon_travail_lignes_piece_id_fkey;
alter table bon_travail_lignes add constraint bon_travail_lignes_piece_id_garage_fkey
  foreign key (piece_id, garage_id) references inventaire (id, garage_id) on delete set null (piece_id);

alter table factures drop constraint factures_bon_travail_id_fkey;
alter table factures add constraint factures_bon_travail_id_garage_fkey
  foreign key (bon_travail_id, garage_id) references bons_travail (id, garage_id) on delete set null (bon_travail_id);

alter table factures drop constraint factures_client_id_fkey;
alter table factures add constraint factures_client_id_garage_fkey
  foreign key (client_id, garage_id) references clients (id, garage_id) on delete set null (client_id);

alter table factures drop constraint factures_vehicule_id_fkey;
alter table factures add constraint factures_vehicule_id_garage_fkey
  foreign key (vehicule_id, garage_id) references vehicules (id, garage_id) on delete set null (vehicule_id);
