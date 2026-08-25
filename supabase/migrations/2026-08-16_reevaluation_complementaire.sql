-- ============================================================
-- Migration : 2026-08-16 — réévaluation complémentaire d'un bon de travail
-- Voir DESIGN.md journal de décisions, D37.
-- Un bandeau rouge signalait déjà un dépassement du montant évalué
-- (`depasseEvaluation` sur bons-travail/[id]), mais rien n'empêchait de
-- continuer les travaux ou de facturer au-delà sans réautorisation du
-- client, et aucune trace n'existait de qui avait accepté quel montant,
-- ni quand. `bon_travail_evaluations` journalise chaque acceptation
-- (initiale et complémentaire) ; `montant_evaluation` sur bons_travail
-- continue de représenter le dernier montant accepté (même principe D13 :
-- figé jusqu'à la prochaine acceptation explicite, jamais recalculé
-- silencieusement).
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

create table bon_travail_evaluations (
  id uuid primary key default gen_random_uuid(),
  bon_travail_id uuid not null references bons_travail(id) on delete cascade,
  montant numeric(10,2) not null,
  type text not null check (type in ('initiale', 'complementaire')),
  accepte_le timestamptz not null default now(),
  accepte_par uuid references profiles(id) on delete set null
);
create index idx_bt_evaluations_bon on bon_travail_evaluations (bon_travail_id, accepte_le);

alter table bon_travail_evaluations enable row level security;

-- Lecture ouverte comme le reste du bon (même le mécanicien assigné doit
-- voir l'historique). Aucune policy insert/update/delete : les seules
-- écritures possibles passent par les fonctions security definer
-- ci-dessous — même logique que D25, le vrai verrou est la fonction, pas
-- une policy qu'on pourrait contourner en écrivant la ligne directement.
create policy "bt_evaluations_select_all" on bon_travail_evaluations
  for select using (auth.role() = 'authenticated');

-- accepter_evaluation() : comportement inchangé, journalise en plus
-- l'acceptation initiale.
create or replace function accepter_evaluation(bon_id uuid)
returns void as $$
declare
  v_total numeric(10,2);
  v_validite_jours int;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent accepter une évaluation.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  select validite_evaluation_jours into v_validite_jours from parametres where id = 1;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_acceptee_le = now(),
      evaluation_valide_jusqu_au = current_date + v_validite_jours,
      statut = 'autorise'
  where id = bon_id;

  insert into bon_travail_evaluations (bon_travail_id, montant, type, accepte_par)
  values (bon_id, v_total, 'initiale', auth.uid());
end;
$$ language plpgsql security definer;

-- Réévaluation complémentaire : même geste que l'acceptation initiale,
-- mais applicable une fois les travaux commencés — ne touche jamais au
-- statut du bon (déjà `autorise`, `en_cours` ou `attente_piece`),
-- seulement au montant accepté et à sa validité. Sépare volontairement
-- ce cas d'accepter_evaluation() plutôt que de la réutiliser : celle-ci
-- fait aussi passer le statut à `autorise`, ce qui ferait reculer un bon
-- déjà en cours de réparation.
create or replace function reevaluer_bon(bon_id uuid)
returns void as $$
declare
  v_total numeric(10,2);
  v_validite_jours int;
  v_statut text;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent réévaluer un bon de travail.';
  end if;

  select statut into v_statut from bons_travail where id = bon_id;
  if v_statut is null then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_statut not in ('autorise', 'en_cours', 'attente_piece') then
    raise exception 'La réévaluation complémentaire ne s''applique qu''à un bon déjà autorisé.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  select validite_evaluation_jours into v_validite_jours from parametres where id = 1;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_valide_jusqu_au = current_date + v_validite_jours
  where id = bon_id;

  insert into bon_travail_evaluations (bon_travail_id, montant, type, accepte_par)
  values (bon_id, v_total, 'complementaire', auth.uid());
end;
$$ language plpgsql security definer;

revoke execute on function reevaluer_bon(uuid) from public;
grant execute on function reevaluer_bon(uuid) to authenticated;
