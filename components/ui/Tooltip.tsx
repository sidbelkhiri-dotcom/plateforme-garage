// Tooltip CSS pur (pas de lib de positionnement) — suffisant pour les cas
// simples du projet. À réévaluer si un jour un besoin de collision avec
// le bord de l'écran apparaît.
export default function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const position = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }[side];

  return (
    <span className="relative inline-flex group">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-mf-sm bg-mf-surface-3 border border-mf-border-strong px-2.5 py-1.5 text-xs font-medium text-mf-text opacity-0 shadow-mf-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${position}`}
      >
        {label}
      </span>
    </span>
  );
}
