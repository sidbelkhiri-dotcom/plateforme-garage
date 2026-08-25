-- ============================================================
-- Migration : 2026-08-25 — encaissement atomique (audit du 18 août, point 8)
--
-- ModalePaiement calculait `facture.montant_paye + montantRecu` en
-- JavaScript à partir d'un instantané chargé à l'ouverture de la facture,
-- puis écrivait le résultat. Deux postes qui encaissent la même facture
-- à quelques secondes d'écart : le deuxième écrase le premier au lieu de
-- s'additionner — un paiement disparaît sans message d'erreur.
--
-- La fonction lit montant_paye au moment de l'exécution, dans la même
-- instruction UPDATE : Postgres verrouille la ligne pendant l'écriture,
-- donc deux appels concurrents s'exécutent l'un après l'autre et le
-- second voit forcément le résultat du premier.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create or replace function enregistrer_paiement(p_facture_id uuid, p_montant numeric)
returns void as $$
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent enregistrer un paiement.';
  end if;
  if p_montant is null or p_montant <= 0 then
    raise exception 'Le montant reçu doit être positif.';
  end if;

  update factures
  set montant_paye = least(montant_paye + p_montant, total_ttc)
  where id = p_facture_id
    and statut <> 'annulee';

  if not found then
    raise exception 'Facture introuvable ou annulée.';
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
