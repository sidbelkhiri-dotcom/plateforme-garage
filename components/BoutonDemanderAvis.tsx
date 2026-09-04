"use client";

import { useState } from "react";
import { Star, Check } from "lucide-react";

export default function BoutonDemanderAvis({
  factureId,
  clientEmail,
  lienAvisConfigure,
}: {
  factureId: string;
  clientEmail: string | null;
  lienAvisConfigure: boolean;
}) {
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setEnEnvoi(true);
    setErreur(null);
    const reponse = await fetch("/api/demander-avis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ factureId }),
    });
    const donnees = await reponse.json();
    setEnEnvoi(false);
    if (!reponse.ok) {
      setErreur(donnees.error ?? "Une erreur est survenue.");
      return;
    }
    setEnvoye(true);
  }

  if (!clientEmail || !lienAvisConfigure) return null;

  return (
    <div className="sans-impression flex flex-col items-end gap-1">
      <button
        onClick={envoyer}
        disabled={enEnvoi || envoye}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold border border-mf-border-strong text-mf-text hover:bg-mf-surface-2 transition-colors disabled:opacity-60"
      >
        {envoye ? <Check className="w-4 h-4 text-mf-success" /> : <Star className="w-4 h-4" />}
        {enEnvoi ? "Envoi..." : envoye ? "Demande envoyée" : "Demander un avis"}
      </button>
      {erreur && <span className="text-xs text-mf-red">{erreur}</span>}
    </div>
  );
}
