"use client";

import { useState } from "react";

export type OngletTabs = { value: string; label: string };

// Contrôlé (valeur + onChange) ou non contrôlé (defaultValue) — au choix
// de l'appelant. Barre 3px active, même motif que la navigation
// principale (BRAND.md §6).
export default function Tabs({
  onglets,
  valeur,
  onChange,
  defaultValue,
}: {
  onglets: OngletTabs[];
  valeur?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
}) {
  const [interne, setInterne] = useState(defaultValue ?? onglets[0]?.value);
  const actif = valeur ?? interne;

  function choisir(v: string) {
    onChange?.(v);
    if (valeur === undefined) setInterne(v);
  }

  return (
    <div role="tablist" className="flex gap-1 border-b border-mf-border">
      {onglets.map((o) => {
        const estActif = o.value === actif;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={estActif}
            onClick={() => choisir(o.value)}
            className={`relative px-4 min-h-[44px] text-sm font-semibold transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue rounded-t-mf-sm ${
              estActif ? "text-mf-text" : "text-mf-text-2 hover:text-mf-text"
            }`}
          >
            {o.label}
            {estActif && <span className="absolute left-0 right-0 -bottom-px h-[3px] bg-mf-blue rounded-mf-pill" />}
          </button>
        );
      })}
    </div>
  );
}
