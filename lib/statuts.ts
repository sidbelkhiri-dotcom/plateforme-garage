import type { ToneBadge } from "@/components/ui/Badge";

// Un seul endroit pour le libellé et la couleur de chaque statut.
//
// Le même bon « Attente pièce » était rouge dans la liste des bons,
// ardoise sur la fiche du véhicule, et les dictionnaires étaient recopiés
// dans six pages qui avaient fini par diverger. La couleur d'un statut est
// une information : elle doit dire la même chose partout.
//
// La grammaire, pour les bons de travail :
//   ambre    — en attente de quelqu'un (le client doit accepter, une pièce
//              doit arriver) : c'est là qu'on relance ;
//   bleu     — à l'atelier, le travail avance ;
//   émeraude — terminé, prêt à facturer ;
//   neutre   — clos (facturé, annulé), plus rien à faire.
// Le rouge reste réservé aux vrais problèmes : impayé, dépassement, stock bas.

export type StatutBon = "evaluation" | "autorise" | "en_cours" | "attente_piece" | "termine" | "facture" | "annule";

export const STATUT_BON: Record<StatutBon, { label: string; ton: ToneBadge }> = {
  evaluation: { label: "Évaluation", ton: "ambre" },
  autorise: { label: "Autorisé", ton: "bleu" },
  en_cours: { label: "En cours", ton: "bleu" },
  attente_piece: { label: "Attente pièce", ton: "ambre" },
  termine: { label: "Terminé", ton: "emeraude" },
  facture: { label: "Facturé", ton: "stone" },
  annule: { label: "Annulé", ton: "stone" },
};

export function statutBon(statut: string): { label: string; ton: ToneBadge } {
  return STATUT_BON[statut as StatutBon] ?? { label: statut, ton: "stone" };
}

export type StatutFacture = "impayee" | "partielle" | "payee" | "annulee";

export const STATUT_FACTURE: Record<StatutFacture, { label: string; ton: ToneBadge }> = {
  impayee: { label: "Impayée", ton: "rouge" },
  partielle: { label: "Partielle", ton: "ambre" },
  payee: { label: "Payée", ton: "emeraude" },
  annulee: { label: "Annulée", ton: "stone" },
};
