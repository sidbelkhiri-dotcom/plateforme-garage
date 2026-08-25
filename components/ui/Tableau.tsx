import { ChevronRight } from "lucide-react";

export type ColonneTableau<T> = {
  cle: string;
  titre: string;
  rendu?: (ligne: T) => React.ReactNode;
  classeCellule?: string;
};

// Un tableau dense devient des cartes empilées sous 768px (D17) — jamais
// un tableau qu'on doit faire défiler horizontalement sur tablette.
export default function Tableau<T extends { id: string }>({
  colonnes,
  lignes,
  surLigneClick,
}: {
  colonnes: ColonneTableau<T>[];
  lignes: T[];
  surLigneClick?: (ligne: T) => void;
}) {
  const valeur = (ligne: T, colonne: ColonneTableau<T>) =>
    colonne.rendu ? colonne.rendu(ligne) : String((ligne as any)[colonne.cle] ?? "");

  return (
    <div className="bg-mf-surface rounded-mf-md border border-mf-border overflow-hidden">
      {/* ≥ 768px : vrai tableau — dans son propre conteneur défilant :
          un tableau large ne fait jamais défiler la page entière. */}
      <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-mf-surface-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-mf-text-3">
            {colonnes.map((c) => (
              <th key={c.cle} className="px-4 py-2.5 font-semibold">
                {c.titre}
              </th>
            ))}
            {surLigneClick && <th className="w-10" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-mf-border">
          {lignes.map((ligne) => (
            <tr
              key={ligne.id}
              onClick={() => surLigneClick?.(ligne)}
              tabIndex={surLigneClick ? 0 : undefined}
              onKeyDown={
                surLigneClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        surLigneClick(ligne);
                      }
                    }
                  : undefined
              }
              className={`text-mf-text ${surLigneClick ? "cursor-pointer hover:bg-mf-surface-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-mf-blue" : ""}`}
            >
              {colonnes.map((c) => (
                <td key={c.cle} className={`px-4 py-3 ${c.classeCellule ?? ""}`}>
                  {valeur(ligne, c)}
                </td>
              ))}
              {surLigneClick && (
                <td className="px-2 text-mf-text-3">
                  <ChevronRight className="w-4 h-4" />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* < 768px : cartes empilées, une par ligne. Un vrai <button> quand la
          ligne est cliquable — un <div onClick> ne reçoit jamais le focus
          clavier et n'écoute pas Entrée/Espace (trouvé en passe d'accessibilité,
          9.3). */}
      <div className="md:hidden divide-y divide-mf-border">
        {lignes.map((ligne) => {
          const ElementLigne = surLigneClick ? "button" : "div";
          return (
            <ElementLigne
              key={ligne.id}
              type={surLigneClick ? "button" : undefined}
              onClick={surLigneClick ? () => surLigneClick(ligne) : undefined}
              className={`w-full text-left p-4 flex flex-col gap-1.5 min-h-[44px] text-mf-text ${
                surLigneClick ? "cursor-pointer active:bg-mf-surface-2" : ""
              }`}
            >
              {colonnes.map((c) => (
                <div key={c.cle} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] uppercase tracking-[0.08em] text-mf-text-3 shrink-0">
                    {c.titre}
                  </span>
                  <span className="text-sm text-right">{valeur(ligne, c)}</span>
                </div>
              ))}
            </ElementLigne>
          );
        })}
      </div>
    </div>
  );
}
