"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";

export default function BoutonEnvoyerEvaluation({
  bonTravailId,
  clientEmail,
  envoyeeLe,
}: {
  bonTravailId: string;
  clientEmail: string | null;
  envoyeeLe: string | null;
}) {
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(!!envoyeeLe);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setEnEnvoi(true);
    setErreur(null);
    const reponse = await fetch("/api/envoyer-evaluation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bonTravailId }),
    });
    const donnees = await reponse.json();
    setEnEnvoi(false);
    if (!reponse.ok) {
      setErreur(donnees.error ?? "Une erreur est survenue.");
      return;
    }
    setEnvoye(true);
  }

  if (!clientEmail) {
    return <span className="sans-impression text-xs text-mf-text-3">Aucun courriel enregistré pour ce client.</span>;
  }

  return (
    <div className="sans-impression flex flex-col items-end gap-1">
      <button
        onClick={envoyer}
        disabled={enEnvoi}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold border border-mf-border-strong text-mf-text hover:bg-mf-surface-2 transition-colors disabled:opacity-60"
      >
        {envoye ? <Check className="w-4 h-4 text-mf-success" /> : <Mail className="w-4 h-4" />}
        {enEnvoi ? "Envoi..." : envoye ? "Renvoyer le devis par courriel" : "Envoyer le devis par courriel"}
      </button>
      {erreur && <span className="text-xs text-mf-red">{erreur}</span>}
    </div>
  );
}
