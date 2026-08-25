-- ============================================================
-- Migration : 2026-08-18 — verrouiller les lignes d'un bon facturé/terminé
-- Signalé en revue mais jamais corrigé : `bt_lignes_write_autorise`
-- n'a jamais vérifié le statut du bon parent — seule l'interface
-- (`peutModifierLignes` sur bons-travail/[id]) cachait les boutons une
-- fois le bon "terminé" ou "facturé". Un appel direct à l'API (ou un
-- futur bug dans l'UI) pouvait donc toujours modifier une ligne après
-- facturation, sans que la facture (qui a déjà copié ses propres
-- montants) ne s'en aperçoive — les deux documents auraient divergé
-- silencieusement. Même trou de classe que D24/D25 : le vrai verrou doit
-- être en base, pas seulement dans l'écran.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

drop policy "bt_lignes_write_autorise" on bon_travail_lignes;
create policy "bt_lignes_write_autorise" on bon_travail_lignes
  for all using (
    exists (
      select 1 from bons_travail bt
      where bt.id = bon_travail_id
        and bt.statut in ('evaluation', 'autorise', 'en_cours', 'attente_piece')
        and (est_role('admin', 'reception') or bt.employe_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from bons_travail bt
      where bt.id = bon_travail_id
        and bt.statut in ('evaluation', 'autorise', 'en_cours', 'attente_piece')
        and (est_role('admin', 'reception') or bt.employe_id = auth.uid())
    )
  );
