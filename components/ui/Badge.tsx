// Couleur sémantique — voir BRAND.md. rouge = impayé / stock bas /
// dépassement d'évaluation · émeraude = sain / terminé · ambre = action ·
// ardoise/stone = neutre.
const TONES = {
  rouge: "bg-mf-red-soft text-mf-red",
  emeraude: "bg-mf-success-soft text-mf-success",
  ambre: "bg-mf-warning-soft text-mf-warning",
  ardoise: "bg-mf-surface-3 text-mf-text-2",
  stone: "bg-mf-surface-2 text-mf-text-2",
} as const;

export type ToneBadge = keyof typeof TONES;

// whitespace-nowrap et shrink-0 ne sont pas cosmétiques : la pastille a une
// hauteur fixe de 22 px, donc un libellé qui passe à la ligne déborde par le
// bas et se fait couper. « En cours » le faisait dans l'en-tête d'un bon de
// travail sur écran étroit. Un badge doit rétrécir la ligne, jamais lui-même.
export default function Badge({
  children,
  tone = "stone",
}: {
  children: React.ReactNode;
  tone?: ToneBadge;
}) {
  return (
    <span
      className={`inline-flex items-center shrink-0 whitespace-nowrap h-[22px] text-[11px] font-bold uppercase tracking-wide px-2.5 rounded-mf-pill ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
