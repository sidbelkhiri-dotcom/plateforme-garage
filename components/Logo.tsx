import LogoMark from "./LogoMark";

// Verrouillage strict : le symbole EST le G du mot, les deux ne se
// dissocient jamais — séparés, la marque se lirait « aragenda ».
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
        aragenda
      </span>
    </span>
  );
}
