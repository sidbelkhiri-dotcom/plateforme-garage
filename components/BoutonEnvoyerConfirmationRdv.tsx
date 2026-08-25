"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";

// Contrairement aux factures/devis, un rendez-vous n'a pas de statut
// "déjà envoyé" à suivre en base — la confirmation part automatiquement
// à la création (voir FormulaireRendezVous), ce bouton sert juste à en
// renvoyer une à jour après une modification.
export default function BoutonEnvoyerConfirmationRdv({ rdvId }: { rdvId: string }) {
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer() {
    setEnEnvoi(true);
    setErreur(null);
    setEnvoye(false);
    const reponse = await fetch("/api/envoyer-confirmation-rdv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rdvId }),
    });
    const donnees = await reponse.json();
    setEnEnvoi(false);
    if (!reponse.ok) {
      setErreur(donnees.error ?? "Une erreur est survenue.");
      return;
    }
    setEnvoye(true);
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={envoyer}
        disabled={enEnvoi}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold border border-mf-border-strong text-mf-text hover:bg-mf-surface-2 transition-colors disabled:opacity-60"
      >
        {envoye ? <Check className="w-4 h-4 text-mf-success" /> : <Mail className="w-4 h-4" />}
        {enEnvoi ? "Envoi..." : "Renvoyer la confirmation par courriel"}
      </button>
      {erreur && <span className="text-xs text-mf-red">{erreur}</span>}
    </div>
  );
}
