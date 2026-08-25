-- ============================================================
-- Migration : 2026-08-17 — notifications en temps réel des nouvelles arrivées
-- Une table doit être explicitement ajoutée à la publication
-- `supabase_realtime` pour que ses changements soient diffusables — rien
-- ne l'était jusqu'ici dans ce projet. La RLS existante
-- (demandes_accueil_select_staff, admin/reception) s'applique aussi aux
-- événements réalimentés : un mécanicien ne recevra rien.
-- À exécuter une fois dans le SQL Editor du projet existant.
-- ============================================================

alter publication supabase_realtime add table demandes_accueil;
