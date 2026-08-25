-- ============================================================
-- Migration : 2026-08-17 — envoi de facture par courriel au client
-- `envoyee_le`/`envoyee_a` tracent le dernier envoi (pas un historique
-- complet — un renvoi écrase la trace précédente, suffisant pour savoir
-- « est-ce déjà parti, et à quelle adresse »). Volontairement pas ajouté
-- au trigger de protection des montants (D31) : contrairement aux
-- montants figés à l'émission, cette information change forcément après
-- coup, comme montant_paye.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table factures
  add column envoyee_le timestamptz,
  add column envoyee_a text;
