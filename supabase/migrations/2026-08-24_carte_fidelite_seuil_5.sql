-- ============================================================
-- Migration : 2026-08-24 — carte de fidélité : seuil 3+1 → 5+1
--
-- Décision commerciale du garage : 5 changements d'huile payés donnent
-- droit au 6e gratuit, plutôt que 3+1. Remplace uniquement le multiplicateur
-- dans la vue ; compte_fidelite/fidelite_offerte et leur logique restent
-- inchangés.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create or replace view cartes_fidelite as
select
  c.id as client_id,
  count(*) filter (where f.compte_fidelite)  as payes,
  count(*) filter (where f.fidelite_offerte) as offerts,
  -- Position dans le cycle courant : 5 payés donnent droit au 6e.
  count(*) filter (where f.compte_fidelite)
    - 5 * count(*) filter (where f.fidelite_offerte) as progression
from clients c
left join factures f
  on f.client_id = c.id
 and f.statut <> 'annulee'
group by c.id;
