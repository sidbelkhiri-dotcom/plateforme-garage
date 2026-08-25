"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Bouton from "@/components/ui/Bouton";

export default function ErreurGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-mf-bg p-6">
      <div className="text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-mf-red mx-auto mb-4" />
        <h1 className="font-display font-bold uppercase tracking-wide text-mf-text mb-2">
          Une erreur est survenue
        </h1>
        <p className="text-sm text-mf-text-2 mb-6">
          Rien n'a été perdu. Réessayez, ou revenez plus tard si le problème persiste.
        </p>
        <Bouton onClick={reset}>Réessayer</Bouton>
      </div>
    </div>
  );
}
