"use client";

import { Printer } from "lucide-react";

// "Impression navigateur + export PDF" (6.2) : la boîte de dialogue
// d'impression du navigateur propose déjà "Enregistrer en PDF" — inutile
// d'ajouter une bibliothèque de génération de PDF séparée pour ça.
export default function BoutonImprimer() {
  return (
    <button
      onClick={() => window.print()}
      className="sans-impression inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold bg-mf-blue hover:bg-mf-blue-hover text-white transition-colors"
    >
      <Printer className="w-4 h-4" /> Imprimer / Exporter en PDF
    </button>
  );
}
