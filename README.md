# Plateforme (nom de marque à venir)

**Ceci n'est pas MECAFORCE SERVICE.** Ce dépôt est le point de départ de la future
plateforme multi-garages, forkée depuis le code de MECAFORCE (application interne
d'un seul garage) le 25 août 2026. MECAFORCE SERVICE continue de vivre dans son
propre dépôt et sa propre base Supabase — rien ici ne doit jamais y toucher.

**À lire en premier :** [`docs/ARCHITECTURE-MULTI-TENANT.md`](docs/ARCHITECTURE-MULTI-TENANT.md)
— le plan d'architecture multi-tenant, l'ordre de migration recommandé, et ce qu'il
reste à faire avant d'onboarder un premier vrai garage client.

## Documentation héritée de MECAFORCE

Ces documents décrivent le produit mono-garage d'origine — toujours utiles comme
référence des règles métier (facturation, conformité OPC, sécurité) qui doivent
survivre au passage multi-tenant, mais ne décrivent pas la Plateforme elle-même.

| Document | Contenu |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | **Ce que fait l'app d'origine** — problème, périmètre V1, contraintes réglementaires OPC, parcours utilisateurs |
| [`docs/DESIGN.md`](docs/DESIGN.md) | **L'interface et la technique** — écrans, schéma de données, journal de décisions |
| [`docs/PLAN.md`](docs/PLAN.md) | **Le plan de construction d'origine** — 10 lots, du socle à la mise en production |
| [`docs/AUDIT.md`](docs/AUDIT.md) | **Audit de sécurité du 18 août** — tous les points sont fermés côté MECAFORCE ; les patrons (RLS, fonctions `security definer`) sont la base du plan multi-tenant |

## Pile technique

- Next.js (App Router) + TypeScript strict
- Tailwind CSS
- Supabase (PostgreSQL, Auth, RLS)
- Déploiement Vercel

## Démarrage

```bash
npm install
cp .env.local.example .env.local   # renseigner les clés Supabase
npm run dev
```

## Règles de travail

1. **Un commit par tâche**, message en français, à l'impératif.
2. **Aucune tâche cochée sans vérification manuelle** — ouvrir la page, cliquer, tester.
3. **Le responsive se teste à chaque lot**, pas à la fin.
4. **Toute décision technique va au journal de `DESIGN.md`**, le jour même.
5. **Toute évolution de schéma passe par une migration datée** dans `supabase/migrations/`.

## État d'avancement

Voir le tableau de suivi en bas de [`docs/PLAN.md`](docs/PLAN.md).
