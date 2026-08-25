"use client";

import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

// Visionneuse plein écran pour agrandir une photo — ouverte depuis la
// galerie d'un véhicule en stock. Flèches gauche/droite pour naviguer
// entre les photos sans refermer, Échap ou clic hors image pour fermer.
export default function Lightbox({
  urls,
  index,
  onIndexChange,
  onFermer,
}: {
  urls: string[];
  index: number;
  onIndexChange: (i: number) => void;
  onFermer: () => void;
}) {
  useEffect(() => {
    function surTouche(e: KeyboardEvent) {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + urls.length) % urls.length);
      if (e.key === "ArrowRight") onIndexChange((index + 1) % urls.length);
    }
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [index, urls.length, onFermer, onIndexChange]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo agrandie"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--mf-overlay)] backdrop-blur-sm p-4"
      onClick={onFermer}
    >
      <button
        onClick={onFermer}
        className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white"
        aria-label="Fermer"
      >
        <X className="w-6 h-6" />
      </button>

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index - 1 + urls.length) % urls.length);
          }}
          className="absolute left-2 sm:left-4 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white"
          aria-label="Photo précédente"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      <img
        src={urls[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-mf-sm"
      />

      {urls.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onIndexChange((index + 1) % urls.length);
          }}
          className="absolute right-2 sm:right-4 w-11 h-11 flex items-center justify-center text-white/80 hover:text-white"
          aria-label="Photo suivante"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {urls.length > 1 && (
        <span className="absolute bottom-4 text-xs text-white/70">
          {index + 1} / {urls.length}
        </span>
      )}
    </div>
  );
}
