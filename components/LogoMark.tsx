"use client";

import { useId } from "react";

// G hexagonal massif, sans contenant : la lettre EST la forme. C'est ce
// qui permet au symbole de tenir la place du G dans « Garagenda » — un
// hexagone qui enferme une lettre se lit comme un badge, et le mot
// d'à côté se lit alors « aragenda ».
//
// Le relief est obtenu en découpant l'hexagone en six secteurs, chacun
// en aplat : c'est ainsi qu'un métal facetté réagit, une face renvoie
// une valeur unique et ne dégrade pas. Lumière au haut à gauche.
//
// Aucune ombre portée : elle appartiendrait au fond et non à la marque.

const SECTEURS = {
  or: {
    hautGauche: "#F5E3A8",
    gauche: "#E3C97A",
    hautDroit: "#D9B85C",
    basGauche: "#C09A3A",
    droit: "#A87F26",
    basDroit: "#8A6318",
  },
  argent: {
    hautGauche: "#FFFFFF",
    gauche: "#E8EBED",
    hautDroit: "#D2D6D9",
    basGauche: "#B4BABE",
    droit: "#94999D",
    basDroit: "#74797D",
  },
};

// Hexagone pointe en haut, R = 46, centré sur (50,50).
const EXTERIEUR = "50,4 89.84,27 89.84,73 50,96 10.16,73 10.16,27";
// Contrepoinçon, R = 26.
const CONTREPOINCON = "50,24 72.52,37 72.52,63 50,76 27.48,63 27.48,37";

export default function LogoMark({
  size = 24,
  metal = "argent",
  className = "",
}: {
  size?: number;
  /** « or » sur fond clair, « argent » sur fond foncé. */
  metal?: "or" | "argent";
  className?: string;
}) {
  // useId renvoie des deux-points, illégaux dans une référence url(#…).
  const masque = `g-${useId().replace(/:/g, "")}`;
  const s = SECTEURS[metal];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <mask id={masque}>
        <polygon points={EXTERIEUR} fill="#fff" />
        <polygon points={CONTREPOINCON} fill="#000" />
        <rect x="60" y="36" width="40" height="16" fill="#000" />
        <rect x="56" y="52" width="44" height="11" fill="#fff" />
      </mask>

      <g mask={`url(#${masque})`}>
        <polygon points="50,50 10.16,27 50,4" fill={s.hautGauche} />
        <polygon points="50,50 50,4 89.84,27" fill={s.hautDroit} />
        <polygon points="50,50 89.84,27 89.84,73" fill={s.droit} />
        <polygon points="50,50 89.84,73 50,96" fill={s.basDroit} />
        <polygon points="50,50 50,96 10.16,73" fill={s.basGauche} />
        <polygon points="50,50 10.16,73 10.16,27" fill={s.gauche} />
      </g>
    </svg>
  );
}
