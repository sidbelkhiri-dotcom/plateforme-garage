// Quand un garage peut-il fonctionner ?
//
// Une seule source pour le code applicatif : middleware.ts (qui redirige
// un garage bloqué vers la facturation) et les tâches planifiées (qui ne
// doivent rien envoyer au nom d'un garage bloqué) lisent tous cette règle.
// Le 2026-09-12 elle existait en deux copies, et les tâches planifiées
// n'en avaient aucune : elles envoyaient SMS et courriels au nom de
// garages suspendus ou résiliés.
//
// Elle a une jumelle côté base, garage_operationnel(), qui gèle
// l'écriture par des politiques RESTRICTIVE. Les deux doivent rester
// identiques — scripts/isolation.mjs éprouve la version SQL état par
// état, y compris la décision de phase pilote décrite dans middleware.ts.

export const STATUTS_ABONNEMENT_BLOQUANTS: readonly string[] = [
  "past_due",
  "canceled",
  "unpaid",
  "incomplete_expired",
];

export type EtatGarage = { statut: string; abonnement_statut: string | null };

// Un abonnement vide n'est PAS bloquant : c'est la décision de phase
// pilote du 2026-09-12 (voir middleware.ts), pas un oubli.
export function garageOperationnel(garage: EtatGarage | null | undefined): boolean {
  if (!garage) return false;
  if (garage.statut !== "actif") return false;
  return garage.abonnement_statut === null || !STATUTS_ABONNEMENT_BLOQUANTS.includes(garage.abonnement_statut);
}
