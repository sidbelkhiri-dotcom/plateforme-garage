-- ============================================================
-- Migration : 2026-08-14 — annulation de facture (avoir)
-- Les factures sont figées depuis D31 : aucun moyen de corriger une
-- erreur jusqu'ici. Ici, jamais d'édition silencieuse — seulement une
-- annulation tracée (motif, qui, quand), qui redonne au bon de travail
-- le droit d'être refacturé proprement.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter table factures
  add column motif_annulation text,
  add column annulee_le timestamptz,
  add column annulee_par uuid references profiles(id) on delete set null;

alter table factures drop constraint factures_statut_check;
alter table factures add constraint factures_statut_check
  check (statut in ('impayee', 'partielle', 'payee', 'annulee'));

-- Une facture annulée ne libère le bon de travail que si une autre
-- facture active n'existe pas déjà — l'index ignore désormais les
-- factures annulées, pour permettre une refacturation.
drop index idx_factures_bon_travail_uniq;
create unique index idx_factures_bon_travail_uniq on factures (bon_travail_id)
  where bon_travail_id is not null and statut <> 'annulee';

-- Le statut se déduisait toujours du montant payé (trigger existant) —
-- il ne doit plus jamais écraser une annulation explicite.
create or replace function maj_statut_facture()
returns trigger as $$
begin
  if new.statut = 'annulee' then
    return new;
  end if;
  if new.total_ttc > 0 and new.montant_paye >= new.total_ttc then
    new.statut := 'payee';
  elsif new.montant_paye > 0 then
    new.statut := 'partielle';
  else
    new.statut := 'impayee';
  end if;
  return new;
end;
$$ language plpgsql;

-- Annulation réservée à l'admin (plus sensible qu'un encaissement) :
-- motif obligatoire, jamais de retour en arrière une fois annulée, et le
-- bon de travail redevient "terminé" pour permettre une facture corrigée.
create or replace function annuler_facture(facture_id uuid, motif text)
returns void as $$
declare
  v_bon_travail_id uuid;
  v_statut_actuel text;
begin
  if not est_role('admin') then
    raise exception 'Seul l''administrateur peut annuler une facture.';
  end if;
  if motif is null or trim(motif) = '' then
    raise exception 'Un motif est obligatoire pour annuler une facture.';
  end if;

  select bon_travail_id, statut into v_bon_travail_id, v_statut_actuel
  from factures where id = facture_id;

  if v_statut_actuel is null then
    raise exception 'Facture introuvable.';
  end if;
  if v_statut_actuel = 'annulee' then
    raise exception 'Cette facture est déjà annulée.';
  end if;

  update factures
  set statut = 'annulee',
      motif_annulation = motif,
      annulee_le = now(),
      annulee_par = auth.uid()
  where id = facture_id;

  if v_bon_travail_id is not null then
    update bons_travail set statut = 'termine' where id = v_bon_travail_id and statut = 'facture';
  end if;
end;
$$ language plpgsql security definer;

revoke execute on function annuler_facture(uuid, text) from public;
grant execute on function annuler_facture(uuid, text) to authenticated;
