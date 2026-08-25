-- ============================================================
-- Migration : 2026-08-23 — verrous d'intégrité issus de l'audit
--
-- Ferme quatre trous relevés dans docs/AUDIT.md :
--   • point 5  — un mécanicien peut faire reculer le statut d'un bon
--                déjà facturé, ce qui rouvre les lignes et re-déclenche
--                le décrément de stock
--   • point 6  — `bon_travail_lignes.quantite` n'a aucune contrainte de
--                signe, ce qui permet d'écrire n'importe quoi dans
--                `inventaire` via le trigger de décrément (security definer)
--   • point 7  — la policy `for all` sur `factures` inclut `delete` :
--                la réception peut supprimer une facture émise sans trace
--   • point 12 — `renonciation_ecrite` n'est pas surveillée par le trigger
--                d'autorisation, donc modifiable par le mécanicien assigné
--
-- Voir DESIGN.md, journal de décisions.
-- À exécuter une fois dans le SQL Editor du projet Supabase.
-- ============================================================


-- ------------------------------------------------------------
-- ÉTAPE 0 — vérifications préalables (à lire AVANT d'exécuter la suite)
--
-- Exécute d'abord ces trois requêtes seules. Si l'une renvoie autre chose
-- que 0, arrête-toi : les contraintes de l'étape 2 échoueraient, et il
-- faut d'abord corriger les lignes fautives.
-- ------------------------------------------------------------

-- select count(*) as lignes_bon_invalides     from bon_travail_lignes where quantite <= 0;
-- select count(*) as lignes_facture_invalides from facture_lignes     where quantite <= 0;
-- select count(*) as pieces_stock_negatif     from inventaire         where quantite < 0;


-- ------------------------------------------------------------
-- ÉTAPE 1 — trigger d'autorisation élargi  (points 5 et 12)
--
-- Remplace la version du 2026-08-12 (D25). Deux ajouts :
--   • `renonciation_ecrite` rejoint les colonnes surveillées — elle est
--     écrite exclusivement par renoncer_evaluation(), réservée au comptoir,
--     et elle apparaît sur un document légal imprimé.
--   • un bon arrivé en `termine`, `facture` ou `annule` ne peut plus changer
--     de statut que par la réception ou l'administrateur. C'est ce qui
--     empêche de rouvrir un bon déjà facturé pour en réécrire les lignes.
--
-- Ajout de `set search_path` au passage : durcissement recommandé par le
-- linter Supabase sur toute fonction `security definer`.
--
-- Effet de bord assumé : un mécanicien qui a marqué un bon « terminé » par
-- erreur ne peut plus le rouvrir lui-même. Il doit passer par le comptoir.
-- ------------------------------------------------------------

create or replace function proteger_autorisation_bon()
returns trigger as $$
begin
  if (
    (new.statut = 'autorise' and old.statut <> 'autorise')
    or new.montant_evaluation     is distinct from old.montant_evaluation
    or new.evaluation_acceptee_le is distinct from old.evaluation_acceptee_le
    or new.renonciation_ecrite    is distinct from old.renonciation_ecrite
    or (old.statut in ('termine', 'facture', 'annule')
        and new.statut is distinct from old.statut)
  ) and not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent autoriser, réévaluer ou rouvrir un bon de travail.';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Le trigger lui-même est inchangé (before update on bons_travail),
-- create or replace suffit : inutile de le recréer.


-- ------------------------------------------------------------
-- ÉTAPE 2 — quantités strictement positives  (point 6)
--
-- Sans cette contrainte, une ligne « pièce » à quantité négative fait
-- AUGMENTER l'inventaire quand le bon passe à « terminé » : le trigger
-- decrementer_stock_bon() est `security definer`, donc il écrit dans
-- `inventaire` en contournant la RLS qui interdit pourtant au mécanicien
-- toute écriture sur cette table.
--
-- Le formulaire envoie déjà `Number(x) || 1`, donc aucune ligne créée par
-- l'interface n'est à 0. La contrainte ferme la voie de l'appel API direct.
-- ------------------------------------------------------------

alter table bon_travail_lignes
  add constraint bon_travail_lignes_quantite_positive check (quantite > 0);

alter table facture_lignes
  add constraint facture_lignes_quantite_positive check (quantite > 0);

-- Défense en profondeur : même avec la contrainte ci-dessus, le stock ne
-- doit jamais pouvoir passer sous zéro.
alter table inventaire
  add constraint inventaire_quantite_non_negative check (quantite >= 0);


-- ------------------------------------------------------------
-- ÉTAPE 3 — plus aucune suppression de facture  (point 7)
--
-- `for all` couvre insert, update ET delete. Or toute la mécanique
-- d'immuabilité comptable repose sur proteger_montants_facture(), un
-- trigger `before insert or update` : il ne voit jamais un delete.
-- La correction d'une facture doit passer par annuler_facture() — admin
-- seulement, motif obligatoire, annulation tracée.
--
-- En l'absence de policy `delete`, PostgreSQL refuse par défaut.
-- ------------------------------------------------------------

drop policy if exists "factures_write_admin_reception" on factures;

-- insert : en pratique inutilisé (creer_facture() est `security definer` et
-- contourne la RLS), conservé pour ne pas bloquer une facture manuelle future.
create policy "factures_insert_admin_reception" on factures
  for insert with check (est_role('admin', 'reception'));

-- update : nécessaire — l'encaissement écrit `montant_paye`, et la route
-- d'envoi par courriel écrit `envoyee_le` / `envoyee_a`. Les 16 colonnes
-- engageantes restent gelées par proteger_montants_facture().
create policy "factures_update_admin_reception" on factures
  for update using (est_role('admin', 'reception'))
  with check (est_role('admin', 'reception'));

drop policy if exists "facture_lignes_write_admin_reception" on facture_lignes;

-- Aucune policy d'écriture sur facture_lignes : l'application ne fait que
-- les lire (vérifié — aucun insert/update/delete côté app). Elles sont
-- écrites uniquement par creer_facture(), en `security definer`.
-- Conséquence voulue : les lignes d'une facture émise deviennent
-- strictement immuables depuis l'API.


-- ------------------------------------------------------------
-- ÉTAPE 4 — vérifications après exécution
--
-- Décommente et exécute pour confirmer que tout est en place.
-- ------------------------------------------------------------

-- -- Doit renvoyer 3 lignes (les 3 nouvelles contraintes)
-- select conrelid::regclass as table_cible, conname
-- from pg_constraint
-- where conname in (
--   'bon_travail_lignes_quantite_positive',
--   'facture_lignes_quantite_positive',
--   'inventaire_quantite_non_negative'
-- );

-- -- factures : doit montrer insert + update + select, et AUCUN delete.
-- -- facture_lignes : doit montrer select uniquement.
-- select tablename, policyname, cmd
-- from pg_policies
-- where tablename in ('factures', 'facture_lignes')
-- order by tablename, cmd;

-- -- Doit contenir 'renonciation_ecrite' et 'termine'
-- select prosrc from pg_proc where proname = 'proteger_autorisation_bon';
