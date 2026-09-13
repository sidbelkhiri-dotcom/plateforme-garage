-- ============================================================
-- Des adresses publiques lisibles pour les garages québécois.
--
-- generer_slug_garage() remplaçait tout caractère hors a-z et 0-9 par un
-- tiret, sans retirer les accents d'abord. « Atelier pilote
-- (développement) » est ainsi devenu atelier-pilote-d-veloppement ; un
-- « Garage Côté » deviendrait garage-c-t, une « Mécanique Hébert »
-- m-canique-h-bert. C'est l'adresse qu'un garage imprime sous son code QR
-- et met sur son site.
--
-- Les accents du français sont maintenant ramenés à leur lettre de base
-- (œ et æ en deux lettres) avant le nettoyage. translate() plutôt que
-- l'extension unaccent : aucune dépendance à activer, et la liste couvre ce
-- qu'un nom de garage québécois contient réellement.
--
-- Les slugs EXISTANTS ne changent pas, délibérément : un garage a peut-être
-- déjà imprimé son code QR ou partagé son lien, et changer l'adresse les
-- casserait tous. Le déclencheur ne s'exécute d'ailleurs qu'à l'insertion,
-- et seulement quand le slug est vide.
-- ============================================================

create or replace function generer_slug_garage()
returns trigger as $$
declare
  v_base text;
  v_slug text;
  v_compteur int := 0;
begin
  if new.slug is not null and new.slug <> '' then
    return new;
  end if;
  v_base := lower(new.nom);
  v_base := replace(replace(v_base, 'œ', 'oe'), 'æ', 'ae');
  v_base := translate(v_base, 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'garage';
  end if;
  v_slug := v_base;
  while exists (select 1 from garages where slug = v_slug and id <> new.id) loop
    v_compteur := v_compteur + 1;
    v_slug := v_base || '-' || v_compteur;
  end loop;
  new.slug := v_slug;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Fonction de déclencheur : jamais appelée directement.
revoke execute on function generer_slug_garage() from public, anon, authenticated;

select pg_get_functiondef('generer_slug_garage()'::regprocedure) like '%translate%' as migration_appliquee;
