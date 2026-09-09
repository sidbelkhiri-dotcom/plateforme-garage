"use client";

import { Download } from "lucide-react";
import { construireCsv, csvNombre, telechargerCsv } from "@/lib/csv";

export type LigneComptable = {
  numero: string;
  date: string;
  client: string;
  libelle: string;
  total_ht: number;
  montant_tps: number;
  montant_tvq: number;
  total_ttc: number;
  sans_taxe: boolean;
  statut: string;
  montant_paye: number;
};

const ENTETES = [
  "Numéro",
  "Date",
  "Client",
  "Libellé",
  "Total HT",
  "TPS",
  "TVQ",
  "Total TTC",
  "Sans taxe",
  "Statut",
  "Montant payé",
  "Solde",
];

// Les factures annulées figurent dans l'export avec leur statut : le
// comptable a besoin de la trace, et un trou dans la numérotation
// soulèverait plus de questions qu'une ligne annulée à zéro.
export default function BoutonExportComptable({
  lignes,
  nomFichier,
}: {
  lignes: LigneComptable[];
  nomFichier: string;
}) {
  function exporter() {
    const contenu = construireCsv(
      ENTETES,
      lignes.map((l) => [
        l.numero,
        l.date,
        l.client,
        l.libelle,
        csvNombre(l.total_ht),
        csvNombre(l.montant_tps),
        csvNombre(l.montant_tvq),
        csvNombre(l.total_ttc),
        l.sans_taxe ? "Oui" : "Non",
        l.statut,
        csvNombre(l.montant_paye),
        csvNombre(l.total_ttc - l.montant_paye),
      ])
    );
    telechargerCsv(contenu, nomFichier);
  }

  return (
    <button
      onClick={exporter}
      disabled={lignes.length === 0}
      className="flex items-center gap-2 px-4 min-h-[36px] rounded-mf-sm text-xs font-semibold bg-mf-surface text-mf-text-2 border border-mf-border hover:bg-mf-surface-2 hover:text-mf-text disabled:opacity-50 transition-colors"
    >
      <Download className="w-4 h-4" />
      Exporter en CSV
    </button>
  );
}
