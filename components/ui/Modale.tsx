"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function Modale({
  titre,
  surFermeture,
  children,
  large = false,
}: {
  titre: string;
  surFermeture: () => void;
  children: React.ReactNode;
  large?: boolean;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") surFermeture();
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [surFermeture]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--mf-overlay)] backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`bg-mf-surface-2 rounded-mf-lg border border-mf-border shadow-mf-lg w-full ${
          large ? "max-w-2xl" : "max-w-md"
        } max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-mf-border">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide text-mf-text">{titre}</h2>
          <button
            onClick={surFermeture}
            className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center -mr-2 rounded-mf-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
