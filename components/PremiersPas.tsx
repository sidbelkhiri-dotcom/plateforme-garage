"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";

export type EtapePremiersPas = {
  cle: string;
  titre: string;
  aide: string;
  href: string;
  faite: boolean;
  /** Recommandée mais pas indispensable : ne bloque pas la fin du guide. */
  facultative?: boolean;
};

const CLE_MASQUE = "garagenda-premiers-pas-masque";

// Guide du premier garage, en tête du tableau de bord de l'administrateur.
//
// Un garage qui venait de s'inscrire arrivait sur cinq compteurs à zéro et
// des cartes « Aucun… », sans rien qui dise par où commencer. Surtout, il
// pouvait émettre sa première facture avec un taux horaire à 0 $, sans
// adresse ni numéros de taxes — rien ne le lui signalait.
//
// Chaque étape se coche d'elle-même à partir des vraies données du garage
// (paramètres remplis, premier client, premier bon, première facture) : pas
// de case à cocher à la main, donc pas de guide qui ment. Le guide disparaît
// quand les étapes indispensables sont faites. « Masquer » ne vaut que pour
// ce navigateur : c'est un confort, pas un état du garage.
export default function PremiersPas({ etapes, nomGarage }: { etapes: EtapePremiersPas[]; nomGarage: string }) {
  // Affiché par défaut, dès le rendu serveur : un garage neuf doit le voir
  // sans attendre. Seul qui l'a masqué le voit disparaître après chargement.
  const [masque, setMasque] = useState(false);
  useEffect(() => {
    try {
      setMasque(localStorage.getItem(CLE_MASQUE) === "1");
    } catch {
      // stockage bloqué : le guide reste affiché
    }
  }, []);

  const indispensables = etapes.filter((e) => !e.facultative);
  if (indispensables.every((e) => e.faite) || masque) return null;

  const faites = etapes.filter((e) => e.faite).length;
  const prochaine = etapes.find((e) => !e.faite && !e.facultative) ?? etapes.find((e) => !e.faite);

  function masquer() {
    try {
      localStorage.setItem(CLE_MASQUE, "1");
    } catch {
      // stockage indisponible : le guide se masque au moins jusqu'au rechargement
    }
    setMasque(true);
  }

  return (
    <section aria-labelledby="premiers-pas-titre" className="bg-mf-surface border border-mf-border mb-6">
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4 border-b border-mf-border">
        <div className="min-w-0">
          <h2 id="premiers-pas-titre" className="font-display font-bold text-base text-mf-text text-balance">
            Mettre en route {nomGarage}
          </h2>
          <p className="text-sm text-mf-text-2 mt-0.5">
            {faites} étape{faites > 1 ? "s" : ""} sur {etapes.length} — de l&apos;inscription à votre première facture.
          </p>
          {/* Barre de progression : un filet laiton, l'unique accent de l'écran. */}
          <div
            className="mt-3 h-1 bg-mf-surface-2 max-w-xs"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={etapes.length}
            aria-valuenow={faites}
            aria-label="Progression de la mise en route"
          >
            <div className="h-full bg-mf-signal transition-[width] duration-300" style={{ width: `${(faites / etapes.length) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={masquer}
          className="shrink-0 -mr-2 -mt-1 w-11 h-11 flex items-center justify-center text-mf-text-3 hover:text-mf-text focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue"
          aria-label="Masquer le guide de mise en route"
          title="Masquer le guide"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ol className="divide-y divide-mf-border">
        {etapes.map((e, i) => {
          const estProchaine = e.cle === prochaine?.cle;
          return (
            <li key={e.cle}>
              <Link
                href={e.href}
                className={`group flex items-center gap-4 px-5 py-3 min-h-[56px] hover:bg-mf-surface-2 focus:outline-none focus-visible:bg-mf-surface-2 ${
                  estProchaine ? "bg-mf-blue-soft" : ""
                }`}
                aria-current={estProchaine ? "step" : undefined}
              >
                <span
                  className={`shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold tabular-nums border ${
                    e.faite
                      ? "bg-mf-success border-mf-success text-mf-surface"
                      : estProchaine
                        ? "border-mf-blue text-mf-blue"
                        : "border-mf-border-strong text-mf-text-3"
                  }`}
                  aria-hidden
                >
                  {e.faite ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${e.faite ? "text-mf-text-3 line-through decoration-mf-border-strong" : "text-mf-text"}`}>
                    {e.titre}
                    <span className="sr-only">{e.faite ? " — fait" : " — à faire"}</span>
                  </span>
                  {!e.faite && <span className="block text-xs text-mf-text-2 mt-0.5">{e.aide}</span>}
                </span>
                {!e.faite && (
                  <ChevronRight className={`w-4 h-4 shrink-0 ${estProchaine ? "text-mf-blue" : "text-mf-text-3"} group-hover:translate-x-0.5 transition-transform`} />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
