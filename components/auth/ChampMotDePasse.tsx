"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Mot de passe avec bouton « afficher » : sur un téléphone, au comptoir,
// une faute de frappe invisible coûte une tentative et parfois un blocage
// temporaire. L'aide (« 8 caractères minimum ») s'affiche avant l'erreur,
// pas après.
export default function ChampMotDePasse({
  label,
  aide,
  ...props
}: { label: string; aide?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const idAide = aide ? `${props.name ?? "mot-de-passe"}-aide` : undefined;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">{label}</span>
      <span className="relative">
        <input
          {...props}
          type={visible ? "text" : "password"}
          aria-describedby={idAide}
          className="w-full bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm pl-3 pr-12 py-2 text-sm text-mf-text min-h-[44px] transition-colors duration-150 focus:outline-none focus:ring-[3px] focus:border-mf-blue focus:ring-mf-blue-soft"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 w-11 flex items-center justify-center text-mf-text-3 hover:text-mf-text rounded-r-mf-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </span>
      {aide && (
        <span id={idAide} className="text-xs text-mf-text-3">
          {aide}
        </span>
      )}
    </label>
  );
}
