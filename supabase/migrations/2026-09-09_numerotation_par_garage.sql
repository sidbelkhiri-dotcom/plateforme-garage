-- ============================================================
-- Migration : 2026-09-09 — numérotation BT-/FA- par garage
--
-- bons_travail.numero et factures.numero venaient de séquences Postgres
-- globales, partagées par toute la base. En production mutualisée, les
-- numéros de deux garages se mélangeraient dans la même suite. Remplacé
-- par un compteur par garage (garages.compteur_bt / compteur_fa, posés
-- à l'étape 1), incrémenté de façon atomique par un UPDATE qui verrouille
-- la ligne — même patron que enregistrer_paiement().
--
-- L'unicité de `numero` passe de globale à (garage_id, numero) : deux
-- garages peuvent chacun avoir un BT-0001, ce n'est plus une collision.
-- ============================================================

alter table bons_travail drop constraint bons_travail_numero_key;
alter table bons_travail alter column numero drop default;
alter table bons_travail add constraint bons_travail_garage_numero_uniq unique (garage_id, numero);

alter table factures drop constraint factures_numero_key;
alter table factures alter column numero drop default;
alter table factures add constraint factures_garage_numero_uniq unique (garage_id, numero);

drop sequence bon_travail_numero_seq;
drop sequence facture_numero_seq;

create or replace function fixer_numero_bon_travail()
returns trigger as $$
declare
  v_compteur int;
begin
  if new.numero is null then
    update garages set compteur_bt = compteur_bt + 1 where id = new.garage_id
      returning compteur_bt into v_compteur;
    new.numero := 'BT-' || lpad(v_compteur::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger bons_travail_fixer_numero
  before insert on bons_travail
  for each row execute function fixer_numero_bon_travail();

create or replace function fixer_numero_facture()
returns trigger as $$
declare
  v_compteur int;
begin
  if new.numero is null then
    update garages set compteur_fa = compteur_fa + 1 where id = new.garage_id
      returning compteur_fa into v_compteur;
    new.numero := 'FA-' || lpad(v_compteur::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create trigger factures_fixer_numero
  before insert on factures
  for each row execute function fixer_numero_facture();
