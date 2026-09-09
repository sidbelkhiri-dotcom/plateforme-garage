import LogoMark from "./LogoMark";

// Le mot est écrit en entier, le symbole ne remplace aucune lettre : un
// hexagone plein se lit comme un badge et non comme un G, si bien que la
// version « symbole + aragenda » se lisait « aragenda ». Le symbole reste
// utilisable seul (favicon, icône iOS), jamais comme initiale.
export default function Logo({
  height = 20,
  variante = "sombre",
  className = "",
}: {
  height?: number;
  /** « claire » = symbole argent, à poser sur un fond foncé. */
  variante?: "sombre" | "claire";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ height, gap: height * 0.24 }}>
      <LogoMark size={height * 1.12} variante={variante} />
      <span
        className="font-display font-bold tracking-tight"
        style={{ fontSize: height * 0.92, lineHeight: 1 }}
      >
        Garagenda
      </span>
    </span>
  );
}
