-- ============================================================
-- Aucun garage n'hérite plus de l'identité d'un autre.
--
-- La table `parametres` vient du schéma d'origine, écrit pour un seul
-- garage : son nom et ses numéros d'inscription aux taxes y étaient les
-- valeurs par défaut. Le passage à plusieurs garages ne les a jamais
-- retirées.
--
-- À l'inscription, handle_new_user() ne renseigne que le nom : chaque
-- nouveau garage recevait donc les numéros de TPS et de TVQ du garage
-- d'origine, et ses évaluations et factures sortaient sous l'inscription
-- fiscale d'une autre entreprise. Constaté le 2026-09-13 sur un garage créé
-- par une vraie inscription, et reproduit par une sonde.
--
-- Sans valeur par défaut, un garage neuf n'a aucun numéro tant qu'il ne
-- les a pas saisis dans Paramètres — les documents n'affichent alors
-- simplement pas la ligne. Et un paramétrage créé sans nom est refusé au
-- lieu de prendre silencieusement celui d'un autre.
--
-- Les taux de 5 % et 9,975 % restent : ce sont ceux du Québec, pas
-- l'identité de quiconque.
-- ============================================================

alter table parametres alter column nom drop default;
alter table parametres alter column tps drop default;
alter table parametres alter column tvq drop default;

select column_name, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'parametres'
   and column_name in ('nom', 'tps', 'tvq')
 order by column_name;
