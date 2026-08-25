// Motif signature MECAFORCE — trois barres inclinées à -15° (bleu → navy →
// rouge). À utiliser avec parcimonie (BRAND.md §5) : maximum une occurrence
// visible par écran (en-tête, accent de card, filigrane d'état vide/login).
export default function BrandStripes({
  size = 24,
  orientation = "horizontal",
  opacity = 1,
  className = "",
}: {
  size?: number;
  orientation?: "horizontal" | "vertical";
  opacity?: number;
  className?: string;
}) {
  const w = size * 1.65;
  const h = size;
  return (
    <svg
      width={orientation === "vertical" ? h : w}
      height={orientation === "vertical" ? w : h}
      viewBox="0 0 66 40"
      style={{ opacity }}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g transform={orientation === "vertical" ? "rotate(90 33 20)" : undefined}>
        <polygon points="6,40 16,40 28,0 18,0" fill="var(--mf-blue)" />
        <polygon points="22,40 32,40 44,0 34,0" fill="var(--mf-navy)" />
        <polygon points="38,40 48,40 60,0 50,0" fill="var(--mf-red)" />
      </g>
    </svg>
  );
}
