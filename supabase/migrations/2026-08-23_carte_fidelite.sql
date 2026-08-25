-- ============================================================
-- Migration : 2026-08-23 — carte de fidélité « 4e changement d'huile offert »
--
-- Pourquoi récompenser l'entretien plutôt que la dépense : un programme
-- à points pousse le client à ajouter des réparations pour atteindre un
-- palier — exactement le réflexe que la marque du garage promet
-- d'éliminer. Compter les changements d'huile récompense la fidélité
-- sans jamais inciter à une réparation inutile.
--
-- Deux drapeaux explicites plutôt qu'une détection par mots-clés dans
-- les descriptions : le personnel saisit du texte libre, et une facture
-- de freins où l'on a fait l'appoint d'huile ne doit pas compter. Même
-- principe que sans_taxe — une décision commerciale visible, pas une
-- valeur devinée après coup. L'interface pré-coche la case quand elle
-- détecte de l'huile, mais la dernière décision reste humaine.
--
-- Volontairement PAS ajoutés à proteger_montants_facture() : ce ne sont
-- pas des montants, et la réception doit pouvoir corriger une erreur de
-- pointage après l'émission.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

-- IF NOT EXISTS partout : ce script doit pouvoir être relancé sans
-- erreur si une exécution précédente a déjà appliqué une partie.

-- Cette facture compte comme un changement d'huile payé.
alter table factures add column if not exists compte_fidelite boolean not null default false;

-- Cette facture EST le changement d'huile offert (remet le compteur à zéro).
alter table factures add column if not exists fidelite_offerte boolean not null default false;

create index if not exists idx_factures_fidelite on factures (client_id)
  where compte_fidelite or fidelite_offerte;

-- État de la carte par client, recalculé à la lecture — rien à
-- maintenir, donc jamais périmé. Les factures annulées sont exclues :
-- une facture annulée ne représente pas une visite réelle.
create or replace view cartes_fidelite as
select
  c.id as client_id,
  count(*) filter (where f.compte_fidelite)  as payes,
  count(*) filter (where f.fidelite_offerte) as offerts,
  -- Position dans le cycle courant : 3 payés donnent droit au 4e.
  count(*) filter (where f.compte_fidelite)
    - 3 * count(*) filter (where f.fidelite_offerte) as progression
from clients c
left join factures f
  on f.client_id = c.id
 and f.statut <> 'annulee'
group by c.id;

grant select on cartes_fidelite to authenticated;
