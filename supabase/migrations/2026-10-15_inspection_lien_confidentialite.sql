-- ============================================================
-- Migration : 2026-10-15 — la page d'inspection mène à l'avis du garage
--
-- Loi 25 : la page d'inspection montre au client des photos de son
-- véhicule et lui fait approuver des réparations, mais ne disait nulle part
-- qui détient ces renseignements ni comment exercer ses droits. Les
-- formulaires publics du garage renvoient déjà à son avis de
-- confidentialité (/accueil/[slug]/confidentialite) ; il manquait ici le
-- slug pour construire ce lien.
--
-- Un seul champ ajouté : slug_garage, déjà public par nature (il figure
-- dans l'adresse des pages publiques du garage). Le reste de la fonction
-- est repris à l'identique de la migration 2026-10-06.
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
    'telephone_garage', (select nullif(trim(telephone), '') from garages where id = v_inspection.garage_id),
    'slug_garage', (select slug from garages where id = v_inspection.garage_id),
    'vehicule', (
      select nullif(trim(concat_ws(' ', v.marque, v.modele,
               case when v.annee is not null then '(' || v.annee || ')' end)), '')
      from bons_travail b
      join vehicules v on v.id = b.vehicule_id
      where b.id = v_inspection.bon_travail_id
    ),
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

-- create or replace conserve les droits existants ; on les réaffirme quand
-- même, à l'identique, pour que ce fichier se lise seul.
revoke all on function obtenir_inspection_publique(uuid) from public;
grant execute on function obtenir_inspection_publique(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
