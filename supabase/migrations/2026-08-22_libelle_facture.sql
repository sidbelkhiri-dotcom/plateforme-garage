-- ============================================================
-- Migration : 2026-08-22 — libellé libre sur les factures
-- Remplace l'option "Sans taxe" à la création (retirée de l'interface,
-- mais la colonne sans_taxe et son traitement fiscal restent en place
-- pour les factures déjà émises avec ce choix — rien n'est effacé).
-- `libelle` est un texte libre, purement pour identifier une facture
-- soi-même (aucun effet sur le calcul des montants ou des taxes),
-- volontairement PAS ajouté à la liste des champs figés par
-- proteger_montants_facture() : modifiable après coup sans contrainte.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table factures add column libelle text;
