"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

// Recherche côté serveur (.ilike() dans la page appelante), jamais un
// filtrage en JavaScript sur un tableau déjà chargé (§6, règle 3).
// Anti-rebond intégré : `onRecherche` n'est appelé qu'après une pause de
// frappe, pas à chaque lettre.
export default function ChampRecherche({
  placeholder = "Rechercher...",
  onRecherche,
  delaiMs = 300,
}: {
  placeholder?: string;
  onRecherche: (terme: string) => void;
  delaiMs?: number;
}) {
  const [terme, setTerme] = useState("");

  useEffect(() => {
    const id = setTimeout(() => onRecherche(terme), delaiMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terme]);

  return (
    <div className="relative max-w-sm w-full">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mf-text-3" />
      <input
        value={terme}
        onChange={(e) => setTerme(e.target.value)}
        placeholder={placeholder}
        className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm pl-9 pr-3 min-h-[44px] text-sm text-mf-text w-full placeholder:text-mf-text-3 transition-colors duration-150 focus:outline-none focus:border-mf-blue focus:ring-[3px] focus:ring-mf-blue-soft"
      />
    </div>
  );
}
