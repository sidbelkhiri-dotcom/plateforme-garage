-- ============================================================
-- Suite d'isolation (étape 5/6 du plan) — vérification
--
-- Script complet, à coller et exécuter EN UN SEUL BLOC (setup +
-- vérification), pour que la table temporaire _test_ids reste visible
-- tout du long dans la même session. Rien n'est laissé en place à la
-- fin : chaque bloc de test se termine par un rollback.
--
-- Compte A (garage pilote) : a142251e-9258-41fa-aac5-477c46019b59
-- Compte B (garage de test): aa7ae84d-dd67-489c-ba60-6b6fe7cd89a5
-- ============================================================

-- ------------------------------------------------------------
-- SETUP
-- ------------------------------------------------------------
begin;

create temp table _test_ids (cle text primary key, valeur uuid);
create temp table _test_resultats (verification text, attendu text, obtenu text, statut text);

do $$
declare
  v_garage_a uuid;
  v_garage_b uuid;
  v_client_a uuid;
  v_client_b uuid;
  v_vehicule_a uuid;
  v_vehicule_b uuid;
  v_bon_a uuid;
  v_bon_b uuid;
begin
  select id into v_garage_a from garages where nom = 'Atelier pilote (développement)';
  insert into garages (nom) values ('Atelier de test B (isolation)') returning id into v_garage_b;

  insert into clients (nom, telephone, garage_id)
    values ('Client Test A', '5145550001', v_garage_a) returning id into v_client_a;
  insert into clients (nom, telephone, garage_id)
    values ('Client Test B', '5145550002', v_garage_b) returning id into v_client_b;

  -- Même plaque dans les deux garages, volontairement.
  insert into vehicules (client_id, marque, modele, plaque, garage_id)
    values (v_client_a, 'Toyota', 'Corolla', 'COLLISION-1', v_garage_a) returning id into v_vehicule_a;
  insert into vehicules (client_id, marque, modele, plaque, garage_id)
    values (v_client_b, 'Toyota', 'Corolla', 'COLLISION-1', v_garage_b) returning id into v_vehicule_b;

  insert into bons_travail (client_id, vehicule_id, kilometrage, plainte_client, taux_horaire, garage_id, statut)
    values (v_client_a, v_vehicule_a, 50000, 'Test isolation A', 90, v_garage_a, 'evaluation')
    returning id into v_bon_a;
  insert into bons_travail (client_id, vehicule_id, kilometrage, plainte_client, taux_horaire, garage_id, statut)
    values (v_client_b, v_vehicule_b, 60000, 'Test isolation B', 90, v_garage_b, 'evaluation')
    returning id into v_bon_b;

  insert into _test_ids values
    ('garage_a', v_garage_a), ('garage_b', v_garage_b),
    ('client_a', v_client_a), ('client_b', v_client_b),
    ('vehicule_a', v_vehicule_a), ('vehicule_b', v_vehicule_b),
    ('bon_a', v_bon_a), ('bon_b', v_bon_b);

  update profiles set garage_id = v_garage_b where id = 'aa7ae84d-dd67-489c-ba60-6b6fe7cd89a5';
end $$;

commit;

select 'setup termine' as etape, * from _test_ids order by cle;

-- ------------------------------------------------------------
-- TESTS — connecté comme le compte du garage A
-- ------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "a142251e-9258-41fa-aac5-477c46019b59", "role": "authenticated"}';

insert into _test_resultats
select 'A ne voit pas client B (select)', '0 ligne', count(*)::text,
  case when count(*) = 0 then 'OK' else 'FUITE' end
from clients where id = (select valeur from _test_ids where cle = 'client_b');

insert into _test_resultats
select 'A ne voit pas vehicule B (select)', '0 ligne', count(*)::text,
  case when count(*) = 0 then 'OK' else 'FUITE' end
from vehicules where id = (select valeur from _test_ids where cle = 'vehicule_b');

insert into _test_resultats
select 'A ne voit pas bon B (select)', '0 ligne', count(*)::text,
  case when count(*) = 0 then 'OK' else 'FUITE' end
from bons_travail where id = (select valeur from _test_ids where cle = 'bon_b');

insert into _test_resultats
select 'A voit bien son propre client A (select)', '1 ligne', count(*)::text,
  case when count(*) = 1 then 'OK' else 'PROBLEME' end
from clients where id = (select valeur from _test_ids where cle = 'client_a');

do $$
declare v_rows int;
begin
  update clients set nom = 'PIRATE-TEST' where id = (select valeur from _test_ids where cle = 'client_b');
  get diagnostics v_rows = row_count;
  insert into _test_resultats values ('A ne peut pas UPDATE client B', '0 ligne', v_rows || ' ligne(s)',
    case when v_rows = 0 then 'OK' else 'FUITE' end);
end $$;

do $$
declare v_rows int;
begin
  delete from vehicules where id = (select valeur from _test_ids where cle = 'vehicule_b');
  get diagnostics v_rows = row_count;
  insert into _test_resultats values ('A ne peut pas DELETE vehicule B', '0 ligne', v_rows || ' ligne(s)',
    case when v_rows = 0 then 'OK' else 'FUITE' end);
end $$;

do $$
begin
  begin
    perform accepter_evaluation((select valeur from _test_ids where cle = 'bon_b'), 0);
    insert into _test_resultats values ('A ne peut pas accepter_evaluation(bon B)', 'exception levée', 'AUCUNE EXCEPTION', 'FUITE');
  exception when others then
    insert into _test_resultats values ('A ne peut pas accepter_evaluation(bon B)', 'exception levée', sqlerrm, 'OK');
  end;
end $$;

do $$
begin
  begin
    perform reevaluer_bon((select valeur from _test_ids where cle = 'bon_b'), 0);
    insert into _test_resultats values ('A ne peut pas reevaluer_bon(bon B)', 'exception levée', 'AUCUNE EXCEPTION', 'FUITE');
  exception when others then
    insert into _test_resultats values ('A ne peut pas reevaluer_bon(bon B)', 'exception levée', sqlerrm, 'OK');
  end;
end $$;

do $$
begin
  begin
    perform renoncer_evaluation((select valeur from _test_ids where cle = 'bon_b'));
    insert into _test_resultats values ('A ne peut pas renoncer_evaluation(bon B)', 'exception levée', 'AUCUNE EXCEPTION', 'FUITE');
  exception when others then
    insert into _test_resultats values ('A ne peut pas renoncer_evaluation(bon B)', 'exception levée', sqlerrm, 'OK');
  end;
end $$;

-- Contrôle positif : A doit pouvoir accepter l'évaluation de SON PROPRE
-- bon (0 ligne = 0 $) — un test d'isolation qui "passe" uniquement parce
-- que tout est cassé ne prouve rien.
do $$
begin
  begin
    perform accepter_evaluation((select valeur from _test_ids where cle = 'bon_a'), 0);
    insert into _test_resultats values ('A PEUT accepter_evaluation(son propre bon A)', 'succès', 'succès', 'OK');
  exception when others then
    insert into _test_resultats values ('A PEUT accepter_evaluation(son propre bon A)', 'succès', sqlerrm, 'PROBLEME');
  end;
end $$;

rollback;

-- ------------------------------------------------------------
-- TESTS — connecté comme le compte du garage B (sens inverse)
-- ------------------------------------------------------------
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub": "aa7ae84d-dd67-489c-ba60-6b6fe7cd89a5", "role": "authenticated"}';

insert into _test_resultats
select 'B ne voit pas client A (select)', '0 ligne', count(*)::text,
  case when count(*) = 0 then 'OK' else 'FUITE' end
from clients where id = (select valeur from _test_ids where cle = 'client_a');

do $$
declare v_rows int;
begin
  update bons_travail set plainte_client = 'PIRATE-TEST' where id = (select valeur from _test_ids where cle = 'bon_a');
  get diagnostics v_rows = row_count;
  insert into _test_resultats values ('B ne peut pas UPDATE bon A', '0 ligne', v_rows || ' ligne(s)',
    case when v_rows = 0 then 'OK' else 'FUITE' end);
end $$;

do $$
begin
  begin
    perform accepter_evaluation((select valeur from _test_ids where cle = 'bon_a'), 0);
    insert into _test_resultats values ('B ne peut pas accepter_evaluation(bon A)', 'exception levée', 'AUCUNE EXCEPTION', 'FUITE');
  exception when others then
    insert into _test_resultats values ('B ne peut pas accepter_evaluation(bon A)', 'exception levée', sqlerrm, 'OK');
  end;
end $$;

rollback;

-- ------------------------------------------------------------
-- RÉSULTATS
-- ------------------------------------------------------------
select * from _test_resultats order by statut desc, verification;
