-- ============================================================
-- Une seule identité par garage.
--
-- Le nom, l'adresse, le téléphone et le courriel d'un garage existaient
-- en double : dans `garages` et dans `parametres`. À l'inscription,
-- handle_new_user() écrit la même valeur des deux côtés — mais c'est
-- `parametres` que le garage modifie ensuite, depuis l'écran Paramètres.
-- `garages` n'était plus jamais mis à jour.
--
-- Or les deux étaient lus par des écrans différents :
--   garages.nom     page d'inspection du client, courriel qui envoie le
--                   lien, rappels de rendez-vous, relances après refus
--   parametres.nom  évaluation écrite, facture, courriels de facture,
--                   de confirmation et de demande d'avis
--
-- Un garage qui se renommait envoyait donc, pour une même visite, des SMS
-- et un lien d'inspection sous son ancien nom, et une évaluation et une
-- facture sous le nouveau. L'atelier pilote en était là le 2026-09-12 :
-- « Atelier pilote (développement) » d'un côté, le nom du garage d'origine de l'autre.
--
-- Et le téléphone ajouté à la page d'inspection le 2026-10-06 lisait
-- garages.telephone, que rien ne renseigne : il serait resté vide pour
-- tous les garages réels.
--
-- `parametres` est la source : c'est ce que le garage édite, et c'est là
-- que vit son identité légale (TPS, TVQ). Un déclencheur recopie ces
-- quatre champs vers `garages` à chaque écriture. On aurait pu réécrire
-- les cinq lecteurs de garages.nom — mais c'est précisément ce genre
-- d'oubli qui a créé l'écart, et le prochain écran l'aurait refait. Avec
-- la copie maintenue par la base, peu importe laquelle des deux on lit.
--
-- Sans effet sur le slug de la page publique : generer_slug_garage() ne
-- s'exécute qu'à l'insertion, et seulement si le slug est vide.
-- ============================================================

create or replace function synchroniser_identite_garage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- security definer : `garages` n'a aucune politique d'écriture pour les
  -- comptes d'un garage, et c'est voulu. Le déclencheur écrit pour eux,
  -- et seulement ces quatre champs.
  update garages
     set nom       = coalesce(nullif(trim(new.nom), ''), garages.nom),
         adresse   = new.adresse,
         telephone = new.telephone,
         courriel  = new.courriel
   where garages.id = new.garage_id
     and (garages.nom       is distinct from coalesce(nullif(trim(new.nom), ''), garages.nom)
       or garages.adresse   is distinct from new.adresse
       or garages.telephone is distinct from new.telephone
       or garages.courriel  is distinct from new.courriel);
  return new;
end;
$$;

-- Fonction de déclencheur : jamais appelée directement. On révoque aussi
-- à PUBLIC — c'est par là que PostgreSQL accorde EXECUTE par défaut, et
-- l'inventaire des fonctions publiques de la suite d'inspection le signale.
revoke execute on function synchroniser_identite_garage() from public, anon, authenticated;

drop trigger if exists parametres_synchroniser_identite on parametres;
create trigger parametres_synchroniser_identite
  after insert or update of nom, adresse, telephone, courriel on parametres
  for each row execute function synchroniser_identite_garage();

-- Rattrapage des garages existants.
update garages g
   set nom       = coalesce(nullif(trim(p.nom), ''), g.nom),
       adresse   = p.adresse,
       telephone = p.telephone,
       courriel  = p.courriel
  from parametres p
 where p.garage_id = g.id;

notify pgrst, 'reload schema';

select count(*) filter (where g.nom is distinct from p.nom) as noms_encore_divergents
  from garages g join parametres p on p.garage_id = g.id;
