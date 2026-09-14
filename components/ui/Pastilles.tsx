"use client";

// Rangée de filtres exclusifs (statut d'un bon, d'une facture…).
//
// Sur téléphone, les huit filtres des bons de travail passaient sur trois
// lignes et poussaient la liste elle-même hors de l'écran. Ils tiennent
// maintenant sur une seule rangée qui défile au doigt ; à partir de la
// tablette, ils reviennent à la ligne normalement. La marge négative laisse
// la rangée filer jusqu'au bord de l'écran, pour qu'on voie qu'elle continue.
export default function Pastilles<V extends string>({
  options,
  valeur,
  onChange,
  libelle,
}: {
  options: { value: V; label: string }[];
  valeur: V;
  onChange: (v: V) => void;
  /** Nom du groupe pour les lecteurs d'écran, ex. « Filtrer par statut ». */
  libelle: string;
}) {
  return (
    <div
      role="group"
      aria-label={libelle}
      className="-mx-6 px-6 sm:mx-0 sm:px-0 flex gap-1 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {options.map((o) => {
        const actif = o.value === valeur;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={actif}
            className={`shrink-0 whitespace-nowrap px-3 min-h-[40px] rounded-mf-pill text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue focus-visible:ring-offset-1 ${
              actif
                ? "bg-mf-blue text-white border-mf-blue"
                : "bg-mf-surface text-mf-text-2 border-mf-border hover:bg-mf-surface-2 hover:text-mf-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
