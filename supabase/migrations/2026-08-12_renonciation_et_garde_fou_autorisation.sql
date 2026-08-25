-- ============================================================
-- Migration : 2026-08-12 — renonciation écrite + garde-fou d'autorisation
-- Lot 5 (bons de travail). Voir DESIGN.md journal de décisions, D25.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

-- Renonciation écrite : le client refuse une évaluation détaillée, donc
-- aucun montant n'est figé (pas de plafond légal dans ce cas — PRD §4.1).
-- Même garde-fou qu'accepter_evaluation() : admin/reception seulement.
create or replace function renoncer_evaluation(bon_id uuid)
returns void as $$
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent enregistrer une renonciation.';
  end if;

  update bons_travail
  set renonciation_ecrite = true,
      evaluation_acceptee_le = now(),
      statut = 'autorise'
  where id = bon_id;
end;
$$ language plpgsql security definer;

revoke execute on function renoncer_evaluation(uuid) from public;
grant execute on function renoncer_evaluation(uuid) to authenticated;

-- D25 (trouvé en construisant le Lot 5) : la RLS s'applique par ligne, pas
-- par colonne (même limite que D23/D24) — la policy "bt_update_..."
-- autoriserait le mécanicien assigné à écrire directement `statut`,
-- `montant_evaluation` ou `evaluation_acceptee_le`, contournant
-- accepter_evaluation()/renoncer_evaluation(). Ce trigger ferme le trou,
-- que l'appel passe par les fonctions ci-dessus ou une requête directe.
create or replace function proteger_autorisation_bon()
returns trigger as $$
begin
  if (
    (new.statut = 'autorise' and old.statut <> 'autorise')
    or new.montant_evaluation is distinct from old.montant_evaluation
    or new.evaluation_acceptee_le is distinct from old.evaluation_acceptee_le
  ) and not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent autoriser un bon de travail.';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists proteger_autorisation_bon_trigger on bons_travail;
create trigger proteger_autorisation_bon_trigger
  before update on bons_travail
  for each row execute function proteger_autorisation_bon();
