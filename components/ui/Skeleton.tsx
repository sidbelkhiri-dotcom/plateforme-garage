// Remplace un spinner plein écran par une silhouette de contenu — voir
// BRAND.md §6. Le défilement (@keyframes shimmer) est neutralisé
// automatiquement pour prefers-reduced-motion (règle globale, globals.css).
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-mf-surface-2 rounded-mf-sm ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-mf-surface-3 to-transparent" />
    </div>
  );
}
