// Hexagone facetté dont le contrepoinçon dessine un G — aucune courbe
// hors du G lui-même, aucun dégradé, aucune ombre (charte « Bleu de
// travail »). L'hexagone prend la couleur du texte courant ; le G est
// évidé, donc l'appelant doit indiquer la couleur exacte du fond sur
// lequel la marque est posée, sinon le G se remplit de blanc.
export default function LogoMark({
  size = 24,
  fond = "var(--mf-surface)",
  className = "",
}: {
  size?: number;
  fond?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <polygon points="24,0 44.78,12 44.78,36 24,48 3.22,36 3.22,12" fill="currentColor" />
      <circle cx="24" cy="24" r="15" fill={fond} />
      <circle cx="24" cy="24" r="8" fill="currentColor" />
      <rect x="24" y="19" width="18" height="10" fill="currentColor" />
      <rect x="26" y="21.5" width="13" height="5" fill={fond} />
    </svg>
  );
}
