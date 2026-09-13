-- ============================================================
-- La page d'inspection du client : le véhicule et le téléphone du garage.
--
-- La page publique ne disait pas de quel véhicule il s'agissait. Un client
-- qui a deux voitures, ou une flotte, ne savait pas laquelle était
-- inspectée. Et aucun numéro n'était affiché : on lui demandait d'approuver
-- des centaines de dollars de réparations sans personne à qui poser une
-- question.
--
-- Deux champs ajoutés, et deux seulement, parce que cette fonction est
-- appelable sans compte par quiconque détient le lien :
--
--   vehicule          marque, modèle et année — assez pour reconnaître sa
--                     voiture. PAS la plaque ni le NIV : ils identifient une
--                     personne, et le client n'en a pas besoin pour savoir
--                     de quelle voiture on parle. scripts/inspection.mjs
--                     échoue s'ils apparaissent un jour dans la réponse.
--   telephone_garage  une information publique du garage.
--
-- Le reste est inchangé, en particulier le message d'erreur unique pour un
-- jeton inexistant, révoqué ou expiré.
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
