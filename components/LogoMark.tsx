"use client";

import { useId } from "react";

// Hexagone biseauté renfermant un G, reconstruit en vectoriel.
// Le biseau est fait de six facettes en aplat — c'est ainsi qu'un vrai
// chanfrein réagit à la lumière, une facette ne dégrade pas — éclairées
// depuis le haut à gauche. Seules la face intérieure et l'or sont en
// dégradé.
//
// Le G est lui-même hexagonal : ses fûts suivent les angles du cadre au
// lieu de décrire un cercle, ce qui fait tenir la lettre et le contenant
// dans une seule géométrie.
//
// Aucune ombre portée : elle appartiendrait au fond et non à la marque,
// et rendrait le logo inutilisable sur une surface foncée.
const FACETTES = {
  sombre: {
    hautGauche: "#4A6B85",
    gauche: "#3C5C76",
    hautDroit: "#2E4E66",
    basGauche: "#22405A",
    droit: "#1A3348",
    basDroit: "#14293A",
  },
  claire: {
    hautGauche: "#F2F5F7",
    gauche: "#E4EAEE",
    hautDroit: "#D3DADF",
    basGauche: "#BFC7CD",
    droit: "#A8B2BA",
    basDroit: "#8F9AA3",
  },
};

const FACE = {
  sombre: ["#24455F", "#0C1B26"],
  claire: ["#EDF1F4", "#B9C2C9"],
};

export default function LogoMark({
  size = 24,
  variante = "sombre",
  className = "",
}: {
  size?: number;
  /** « claire » = corps argent, à poser sur un fond foncé. */
  variante?: "sombre" | "claire";
  className?: string;
}) {
  // useId renvoie des deux-points, illégaux dans une référence url(#…).
  const uid = useId().replace(/:/g, "");
  const face = `face-${uid}`;
  const or = `or-${uid}`;
  const f = FACETTES[variante];
  const [faceHaut, faceBas] = FACE[variante];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={face} gradientUnits="userSpaceOnUse" x1="17" y1="12" x2="83" y2="88">
          <stop offset="0" stopColor={faceHaut} />
          <stop offset="1" stopColor={faceBas} />
        </linearGradient>
        <linearGradient id={or} gradientUnits="userSpaceOnUse" x1="26" y1="26" x2="74" y2="74">
          <stop offset="0" stopColor="#F5E7B0" />
          <stop offset="0.35" stopColor="#D9B84A" />
          <stop offset="0.6" stopColor="#C9A227" />
          <stop offset="1" stopColor="#8F7018" />
        </linearGradient>
      </defs>

      <polygon points="8.43,26 50,2 50,12 17.1,31" fill={f.hautGauche} />
      <polygon points="50,2 91.57,26 82.9,31 50,12" fill={f.hautDroit} />
      <polygon points="91.57,26 91.57,74 82.9,69 82.9,31" fill={f.droit} />
      <polygon points="91.57,74 50,98 50,88 82.9,69" fill={f.basDroit} />
      <polygon points="50,98 8.43,74 17.1,69 50,88" fill={f.basGauche} />
      <polygon points="8.43,74 8.43,26 17.1,31 17.1,69" fill={f.gauche} />

      <polygon points="50,12 82.9,31 82.9,69 50,88 17.1,69 17.1,31" fill={`url(#${face})`} />

      <polygon points="50,18 77.71,34 77.71,66 50,82 22.29,66 22.29,34" fill={`url(#${or})`} />
      <polygon points="50,32 65.59,41 65.59,59 50,68 34.41,59 34.41,41" fill={`url(#${face})`} />
      <rect x="50" y="43" width="30" height="14" fill={`url(#${face})`} />
      <rect x="50" y="46.5" width="27" height="7" fill={`url(#${or})`} />
    </svg>
  );
}
