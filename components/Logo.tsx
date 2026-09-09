import LogoMark from "./LogoMark";

// Le mot est écrit en entier, le symbole ne remplace aucune lettre : un
// hexagone plein se lit comme un badge et non comme un G, si bien que la
// version « symbole + aragenda » se lisait « aragenda ». Le symbole reste
// utilisable seul (favicon, icône iOS), jamais comme initiale.
// `fond` descend jusqu'au symbole parce que son G est évidé (voir
// LogoMark) : la barre latérale est toujours sombre, les pages
// publiques posent la marque sur une carte blanche.
export default function Logo({
  height = 20,
  fond,
  className = "",
}: {
  height?: number;
  fond?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ height, gap: height * 0.22 }}>
      <LogoMark size={height} fond={fond} />
      <span
        className="font-display font-bold tracking-tight"
        style={{ fontSize: height * 0.92, lineHeight: 1 }}
      >
        Garagenda
      </span>
    </span>
  );
}
