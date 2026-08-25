-- ============================================================
-- Migration : 2026-08-25 — garde-fous sur l'acceptation d'évaluation
-- (audit du 18 août, points 10, 11, 13)
--
-- Trois défauts corrigés ensemble, tous dans les mêmes fonctions :
--
--   • Point 10/13 — accepter_evaluation() et reevaluer_bon() relisaient
--     le total au moment de l'exécution, jamais celui affiché à l'écran
--     au moment du clic. Un mécanicien qui ajoute une ligne pendant que
--     la réception est au téléphone avec le client : le montant figé
--     n'est ni celui annoncé ni celui réellement accepté. Les deux
--     fonctions prennent maintenant p_montant_attendu et refusent si le
--     total a changé entre-temps, plutôt que de figer une divergence en
--     silence.
--
--   • Point 11 — accepter_evaluation() et renoncer_evaluation() ne
--     vérifiaient que le rôle, jamais le statut du bon. Le verrou ajouté
--     le 23 août (proteger_autorisation_bon) bloque un mécanicien, mais
--     PAS un compte admin/reception qui rejoue accepter_evaluation() sur
--     un bon déjà "facture" : rien n'empêchait de le repasser à
--     "autorise", rouvrant des lignes dont la facture est pourtant gelée.
--     Les deux fonctions exigent maintenant statut = 'evaluation'.
--
-- reevaluer_bon() avait déjà sa propre garde de statut (D37) — inchangée
-- ici, seul l'ajout de p_montant_attendu est nouveau pour elle.
--
-- create or replace ne change pas la signature d'une fonction : ajouter
-- un paramètre crée une SURCHARGE en plus de l'ancienne, qui reste
-- appelable telle quelle (même piège que creer_facture(uuid, date), déjà
-- rencontré et corrigé le 22 août). Les deux anciennes signatures à un
-- seul paramètre sont donc explicitement supprimées avant recréation.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

drop function if exists accepter_evaluation(uuid);
drop function if exists reevaluer_bon(uuid);

create or replace function accepter_evaluation(bon_id uuid, p_montant_attendu numeric)
returns void as $$
declare
  v_total numeric(10,2);
  v_validite_jours int;
  v_statut text;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent accepter une évaluation.';
  end if;

  select statut into v_statut from bons_travail where id = bon_id;
  if v_statut is null then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_statut <> 'evaluation' then
    raise exception 'Ce bon n''est plus en évaluation — il a déjà été traité. Rechargez la page.';
  end if;

  select total_ht into v_total from bons_travail_totaux where id = bon_id;
  if v_total is distinct from p_montant_attendu then
    raise exception 'Le montant a changé depuis l''affichage (une ligne a été ajoutée ou modifiée). Rechargez la page et recommencez.';
  end if;

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
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function reevaluer_bon(bon_id uuid, p_montant_attendu numeric)
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
  if v_total is distinct from p_montant_attendu then
    raise exception 'Le montant a changé depuis l''affichage. Rechargez la page et recommencez.';
  end if;

  select validite_evaluation_jours into v_validite_jours from parametres where id = 1;

  update bons_travail
  set montant_evaluation = v_total,
      evaluation_valide_jusqu_au = current_date + v_validite_jours
  where id = bon_id;

  insert into bon_travail_evaluations (bon_travail_id, montant, type, accepte_par)
  values (bon_id, v_total, 'complementaire', auth.uid());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function reevaluer_bon(uuid, numeric) from public;
grant execute on function reevaluer_bon(uuid, numeric) to authenticated;

create or replace function renoncer_evaluation(bon_id uuid)
returns void as $$
declare
  v_statut text;
begin
  if not est_role('admin', 'reception') then
    raise exception 'Seuls la réception et l''administrateur peuvent enregistrer une renonciation.';
  end if;

  select statut into v_statut from bons_travail where id = bon_id;
  if v_statut is null then
    raise exception 'Bon de travail introuvable.';
  end if;
  if v_statut <> 'evaluation' then
    raise exception 'Ce bon n''est plus en évaluation — il a déjà été traité. Rechargez la page.';
  end if;

  update bons_travail
  set renonciation_ecrite = true,
      evaluation_acceptee_le = now(),
      statut = 'autorise'
  where id = bon_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
