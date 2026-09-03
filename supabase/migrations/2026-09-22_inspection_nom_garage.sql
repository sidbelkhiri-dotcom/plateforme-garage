-- ============================================================
-- Migration : 2026-09-22 — inclure le nom du garage dans la réponse publique
--
-- obtenir_inspection_publique() ne renvoyait que l'inspection et ses
-- points — la page publique cliente n'avait aucun moyen d'afficher de
-- quel garage il s'agit. Maintenant possible depuis que inspections a
-- garage_id (migration 2026-09-20). create or replace préserve les
-- grants déjà posés (anon, authenticated) — pas besoin de les reposer.
-- ============================================================

create or replace function obtenir_inspection_publique(p_jeton uuid)
returns jsonb as $$
declare
  v_inspection inspections%rowtype;
  v_resultat jsonb;
begin
  select * into v_inspection from inspections where jeton_acces = p_jeton;

  if v_inspection.id is null
     or v_inspection.revoque
     or (v_inspection.expire_le is not null and v_inspection.expire_le < now())
  then
    raise exception 'Inspection introuvable ou lien expiré.';
  end if;

  if v_inspection.statut = 'envoyee' then
    update inspections set statut = 'consultee' where id = v_inspection.id;
  end if;

  select jsonb_build_object(
    'inspection', jsonb_build_object(
      'id', v_inspection.id,
      'statut', v_inspection.statut,
      'envoyee_le', v_inspection.envoyee_le
    ),
    'nom_garage', (select nom from garages where id = v_inspection.garage_id),
    'points', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'description', p.description,
        'etat', p.etat,
        'recommandation', p.recommandation,
        'prix_estime', p.prix_estime,
        'decision_client', p.decision_client,
        'photos', (
          select coalesce(jsonb_agg(
            jsonb_build_object('identifiant_public', ph.identifiant_public, 'chemin', ph.chemin)
            order by ph.cree_le
          ), '[]'::jsonb)
          from inspection_photos ph where ph.inspection_point_id = p.id
        )
      ) order by p.ordre
    ) filter (where p.id is not null), '[]'::jsonb)
  )
  into v_resultat
  from inspection_points p
  where p.inspection_id = v_inspection.id;

  return v_resultat;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
