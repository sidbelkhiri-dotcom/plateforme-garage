// Une ossature plutôt qu'un tourniquet.
//
// L'ancien état de chargement était un petit engrenage tournant, centré au
// milieu d'une page par ailleurs vide. Deux défauts : la page paraissait
// cassée plutôt qu'occupée, et le contenu surgissait ensuite d'un bloc, en
// déplaçant tout ce qui était déjà à l'écran. Ces barres grises occupent
// à peu près la place que prendront les lignes réelles, dans la même
// géométrie que les listes de l'application — repère court à gauche,
// libellé au centre, montant ou état à droite.
//
// L'animation de pulsation se neutralise d'elle-même pour qui a demandé
// moins de mouvement : la règle prefers-reduced-motion de globals.css
// ramène toutes les durées à zéro. Les barres restent alors simplement
// posées, ce qui se lit encore très bien.
//
// Les colonnes latérales disparaissent sous 640 px : en étroit, un repère
// fixe à gauche et un montant fixe à droite écrasaient les deux barres du
// milieu à quelques pixels. Il ne reste alors que le libellé, ce qui est
// aussi la forme qu'ont réellement les listes sur téléphone.
//
// Les barres empruntent le jeton de bordure, pas celui des surfaces : une
// surface est faite pour disparaître sous le contenu, une bordure pour
// rester visible sur elle. Et c'est vrai des deux côtés — en clair comme
// en sombre, --mf-border est calibré pour se détacher du fond.
//
// Le message textuel n'est plus affiché mais reste annoncé aux lecteurs
// d'écran : visuellement l'ossature dit déjà « ça arrive », alors qu'un
// lecteur d'écran, lui, ne verrait que des blocs vides.

export default function Chargement({
  message = "Chargement...",
  lignes = 5,
}: {
  message?: string;
  lignes?: number;
}) {
  return (
    <div className="py-2" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{message}</span>
      <div className="animate-pulse divide-y divide-mf-border border-y border-mf-border">
        {Array.from({ length: lignes }).map((_, i) => (
          <div key={i} className="px-4 py-4 flex items-center gap-4">
            <div className="hidden sm:block h-3 w-16 shrink-0 bg-mf-border" />
            <div className="flex-1 min-w-0 space-y-2">
              {/* Deux largeurs qui alternent : des barres toutes identiques
                  ressemblent à un tableau réglé, pas à du texte en attente. */}
              <div className="h-3 bg-mf-border" style={{ width: i % 2 === 0 ? "42%" : "34%" }} />
              <div className="h-2.5 bg-mf-border" style={{ width: i % 2 === 0 ? "26%" : "31%" }} />
            </div>
            <div className="hidden sm:block h-3 w-20 shrink-0 bg-mf-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
