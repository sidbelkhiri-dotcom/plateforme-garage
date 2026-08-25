-- ============================================================
-- Migration : 2026-08-14 — décrément automatique du stock
-- Se déclenche précisément quand un bon passe en_cours → terminé, pas
-- dès l'ajout d'une ligne : une pièce mise sur un devis jamais accepté
-- ne doit jamais toucher l'inventaire. Les lignes sont de toute façon
-- gelées dès que le bon est terminé (peutModifierLignes côté app), donc
-- un seul décrément groupé au moment précis de la transition suffit.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

-- Agrège par pièce avant de soustraire — une même pièce peut apparaître
-- sur plusieurs lignes du même bon (ex. ajoutée deux fois par erreur
-- puis pas fusionnée) ; un UPDATE...FROM sans agrégation n'appliquerait
-- arbitrairement qu'une seule des lignes correspondantes.
create or replace function decrementer_stock_bon()
returns trigger as $$
begin
  update inventaire i
  set quantite = i.quantite - s.total_quantite
  from (
    select piece_id, sum(quantite) as total_quantite
    from bon_travail_lignes
    where bon_travail_id = new.id
      and type = 'piece'
      and piece_id is not null
    group by piece_id
  ) s
  where i.id = s.piece_id;
  return new;
end;
$$ language plpgsql security definer;

-- old.statut = 'en_cours' spécifiquement (pas juste "nouveau statut =
-- terminé") : évite un second décrément quand annuler_facture() ramène
-- un bon de 'facture' à 'terminé' pour permettre une facture corrigée.
create trigger bt_decrementer_stock_trigger
  after update on bons_travail
  for each row
  when (new.statut = 'termine' and old.statut = 'en_cours')
  execute function decrementer_stock_bon();
