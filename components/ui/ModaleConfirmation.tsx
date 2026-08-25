"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modale from "./Modale";
import Bouton from "./Bouton";
import MessageErreur from "./MessageErreur";

// Toute suppression passe par ici — jamais par confirm() (D15).
export default function ModaleConfirmation({
  titre,
  message,
  libelleConfirmation = "Supprimer",
  surConfirmation,
  surFermeture,
}: {
  titre: string;
  message: string;
  libelleConfirmation?: string;
  surConfirmation: () => Promise<{ error: string | null }>;
  surFermeture: () => void;
}) {
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function confirmer() {
    setEnEnvoi(true);
    setErreur(null);
    const { error } = await surConfirmation();
    setEnEnvoi(false);
    if (error) {
      setErreur(error);
      return;
    }
    surFermeture();
  }

  return (
    <Modale titre={titre} surFermeture={surFermeture}>
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 text-mf-red shrink-0 mt-0.5" />
        <p className="text-sm text-mf-text-2">{message}</p>
      </div>
      {erreur && <MessageErreur className="mt-3">{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-5">
        <Bouton variante="secondaire" onClick={surFermeture}>
          Annuler
        </Bouton>
        <Bouton variante="danger" onClick={confirmer} enEnvoi={enEnvoi}>
          {libelleConfirmation}
        </Bouton>
      </div>
    </Modale>
  );
}
