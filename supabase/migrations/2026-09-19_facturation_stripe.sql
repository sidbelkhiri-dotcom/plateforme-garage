-- ============================================================
-- Migration : 2026-09-19 — colonnes de facturation Stripe sur garages
--
-- Aucune policy d'écriture n'est ajoutée sur ces colonnes : elles ne
-- sont jamais modifiées par un utilisateur normal (même admin), seulement
-- par le webhook Stripe côté serveur (clé service_role, qui contourne la
-- RLS). Même philosophie que le reste du projet — le vrai verrou est le
-- code serveur qui vérifie la signature Stripe, pas une policy.
--
-- statut ('actif'|'suspendu'|'resilie') reste le contrôle opérationnel
-- géré par le super-admin (2026-09-15) — abonnement_statut est purement
-- informatif pour l'instant, reflète l'état Stripe (trialing/active/
-- past_due/canceled/...). Rien ne bloque encore l'accès à l'application
-- automatiquement si l'abonnement expire : décision volontairement
-- différée pour ne pas risquer de verrouiller un garage par erreur avant
-- que le flux de paiement ait fait ses preuves.
-- ============================================================

alter table garages add column stripe_customer_id text;
alter table garages add column stripe_subscription_id text;
alter table garages add column abonnement_statut text;

create unique index garages_stripe_customer_id_uniq on garages (stripe_customer_id) where stripe_customer_id is not null;
create unique index garages_stripe_subscription_id_uniq on garages (stripe_subscription_id) where stripe_subscription_id is not null;
