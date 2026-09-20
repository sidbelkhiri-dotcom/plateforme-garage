"use client";

import { motion } from "framer-motion";
import { Camera, Check, AlertTriangle, CircleCheck, Receipt, FileSpreadsheet } from "lucide-react";

// Maquettes du site vitrine, dessinées avec les mêmes jetons que l'application
// plutôt que des captures d'écran : nettes à toute taille, justes dans les deux
// thèmes, et impossibles à laisser vieillir en décalage avec le vrai produit
// sans qu'on le voie en relisant ce fichier.
//
// « use client » : le héros remplit le bon ligne par ligne (prop `anime`),
// donc ces blocs doivent pouvoir s'animer. Le rendu reste fait sur le serveur ;
// seule l'animation s'ajoute ensuite.
//
// Les montants sont cohérents et vérifiés : 89,95 $ + 1,5 h × 125 $ = 277,45 $,
// TPS 13,87 $, TVQ 27,68 $, total 319,00 $ (arrondi au cent comme la base).
// Les noms sont inventés ; ce sont des exemples, pas des clients.

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-mf-text-3">{children}</span>
  );
}

function Pastille({ ton, children }: { ton: "bleu" | "ambre" | "vert" | "rouge"; children: React.ReactNode }) {
  const tons = {
    bleu: "bg-mf-blue-soft text-mf-blue",
    ambre: "bg-mf-warning-soft text-mf-warning",
    vert: "bg-mf-success-soft text-mf-success",
    rouge: "bg-mf-red-soft text-mf-red",
  } as const;
  return (
    <span className={`inline-flex items-center h-5 px-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${tons[ton]}`}>
      {children}
    </span>
  );
}

/**
 * Bon de travail, vu par la réception.
 *
 * `anime` fait tomber la plainte, puis chaque ligne, puis le total — le
 * geste réel de la réception qui remplit le bon. Sans lui, tout est déjà là.
 */
export function MaquetteBon({ className = "", anime = false, delai = 0 }: { className?: string; anime?: boolean; delai?: number }) {
  const ligne = (rang: number) =>
    anime
      ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: delai + rang * 0.22, duration: 0.4, ease: [0.16, 0.8, 0.3, 1] as const } }
      : {};
  return (
    <div className={`bg-mf-surface border border-mf-border text-mf-text ${className}`} aria-hidden>
      <div className="px-5 pt-4 pb-3 border-b border-mf-border">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-lg font-semibold">BT-0006</span>
          <Pastille ton="bleu">En cours</Pastille>
        </div>
        <div className="mt-1 text-xs text-mf-text-2">Marc-André Thibault · Honda Civic (2018) · 78 600 km</div>
      </div>
      <motion.div className="px-5 py-3 border-b border-mf-border" {...ligne(0)}>
        <Etiquette>Plainte du client</Etiquette>
        <p className="text-sm mt-0.5">Témoin moteur allumé depuis 3 jours</p>
      </motion.div>
      <div className="px-5 py-2 divide-y divide-mf-border text-sm">
        <motion.div className="py-2 flex items-baseline justify-between gap-3" {...ligne(1)}>
          <div>
            <div className="font-medium">Batterie 600 ACC</div>
            <div className="text-xs text-mf-text-3">Neuve · 1 × 189,00 $</div>
          </div>
          <span className="font-mono tabular-nums">189,00 $</span>
        </motion.div>
        <motion.div className="py-2 flex items-baseline justify-between gap-3" {...ligne(2)}>
          <div>
            <div className="font-medium">Diagnostic électrique</div>
            <div className="text-xs text-mf-text-3">1 h · 125,00 $/h</div>
          </div>
          <span className="font-mono tabular-nums">125,00 $</span>
        </motion.div>
      </div>
      <motion.div className="px-5 py-3 bg-mf-surface-2 border-t border-mf-border flex items-center justify-between gap-3" {...ligne(3)}>
        <span className="flex items-center gap-1.5 text-xs text-mf-success font-semibold">
          <CircleCheck className="w-3.5 h-3.5 shrink-0" /> Évaluation acceptée
        </span>
        <span className="font-mono tabular-nums font-bold whitespace-nowrap">314,00 $</span>
      </motion.div>
    </div>
  );
}

/** Facture réduite à ce qui compte dans le héros : le numéro et les taxes. */
export function MaquetteFactureCompacte({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white text-[#16212a] border border-mf-border px-4 py-3 ${className}`} aria-hidden>
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#e3e0d8]">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
          <Receipt className="w-3.5 h-3.5" /> Facture
        </span>
        <span className="font-mono text-[11px] text-[#5c666e]">FA-0002</span>
      </div>
      <div className="pt-2 flex flex-col gap-1 text-[11.5px]">
        {[
          ["Avant taxes", "277,45 $"],
          ["TPS (5 %)", "13,87 $"],
          ["TVQ (9,975 %)", "27,68 $"],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between">
            <span className="text-[#5c666e]">{l}</span>
            <span className="font-mono tabular-nums">{v}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-[13px] border-t border-[#e3e0d8] pt-1.5 mt-1">
          <span>Total</span>
          <span className="font-mono tabular-nums">319,00 $</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Page d'inspection, telle que le client la reçoit sur son téléphone.
 *
 * `approuve`, `pressee` et `montantApprouve` sont pilotés par
 * TelephoneDemo pour rejouer le geste du client ; sans eux, la maquette
 * reste dans son état d'attente.
 */
export function MaquetteTelephone({
  className = "",
  approuve = false,
  pressee = false,
  montantApprouve,
}: {
  className?: string;
  approuve?: boolean;
  pressee?: boolean;
  montantApprouve?: React.ReactNode;
}) {
  return (
    <div
      className={`w-[248px] bg-mf-sidebar-bg p-2 border border-mf-sidebar-border ${className}`}
      aria-label="Exemple : la page d'inspection reçue par le client sur son téléphone"
      role="img"
    >
      <div className="bg-mf-bg text-mf-text overflow-hidden">
        <div className="px-3 pt-4 pb-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.09em] text-mf-text-3">Garage Lavoie</div>
          <div className="font-display font-bold text-[15px] leading-tight mt-0.5">Inspection de votre Mazda 3</div>
        </div>
        <div className="px-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-mf-red">
          <AlertTriangle className="w-3 h-3" /> À réparer · 1
        </div>
        <div className="mx-3 mt-1.5 bg-mf-surface border border-mf-border p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] font-semibold">Plaquettes avant</span>
            <span className="font-mono text-[12px] font-semibold tabular-nums">289,95 $</span>
          </div>
          {/* Photo d'atelier stylisée : une mesure d'usure, pas un faux cliché. */}
          <div className="relative mt-2 h-[74px] bg-[linear-gradient(135deg,#2b3a44,#18242c)] overflow-hidden">
            <div className="absolute inset-y-3 left-5 w-12 border-2 border-[#8f9aa2] opacity-70" />
            <div className="absolute top-3 bottom-3 left-[74px] w-[3px] bg-[#c8ced2]" />
            <div className="absolute left-[84px] top-1/2 -translate-y-1/2 h-px w-10 bg-mf-signal" />
            <span className="absolute left-[128px] top-1/2 -translate-y-1/2 font-mono text-[11px] font-bold text-mf-signal">2 mm</span>
            <Camera className="absolute right-2 bottom-2 w-3.5 h-3.5 text-white/70" />
          </div>
          <p className="text-[10.5px] text-mf-text-2 mt-2 leading-snug">Usure au témoin. Recommandé avant l&apos;hiver.</p>
          {approuve ? (
            <div className="flex items-center justify-between gap-2 mt-2">
              <span className="inline-flex items-center h-6 px-2 bg-mf-success-soft text-mf-success text-[10px] font-bold uppercase tracking-wide">
                Vous avez approuvé
              </span>
              <span className="text-[11px] font-semibold text-mf-blue">Modifier ma réponse</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <span
                className={`h-8 flex items-center justify-center bg-mf-blue text-mf-on-blue text-[11px] font-semibold transition-transform duration-150 ${
                  pressee ? "scale-[0.96]" : ""
                }`}
              >
                <Check className="w-3 h-3 mr-1" /> Approuver
              </span>
              <span className="h-8 flex items-center justify-center border border-mf-border-strong text-[11px] font-semibold">
                Refuser
              </span>
            </div>
          )}
        </div>
        <div className="px-3 mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-mf-warning">
          <AlertTriangle className="w-3 h-3" /> À surveiller · 1
        </div>
        <div className="mx-3 mt-1.5 bg-mf-surface border border-mf-border p-2.5 flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-semibold">Pneus arrière</span>
          <span className="font-mono text-[12px] tabular-nums">64,50 $</span>
        </div>
        <div className="mt-3 bg-mf-surface border-t border-mf-border px-3 py-2 flex items-center justify-between">
          <span className="text-[10.5px] text-mf-text-2">
            {approuve ? "1 réparation à décider" : "2 réparations à décider"}
          </span>
          <span className="text-right">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.09em] text-mf-text-3">Approuvé</span>
            <span className="block font-mono text-[12px] font-bold tabular-nums">{montantApprouve ?? "0,00 $"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Le refus réel de la base quand on facture au-dessus du prix accepté. */
export function MaquetteDepassement({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-mf-surface border border-mf-border text-mf-text ${className}`} aria-hidden>
      <div className="px-5 py-4 border-b border-mf-border flex items-center justify-between gap-3">
        <span className="font-mono font-semibold">BT-0012</span>
        <Pastille ton="vert">Terminé</Pastille>
      </div>
      <div className="px-5 py-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <Etiquette>Évaluation acceptée</Etiquette>
          <div className="font-mono text-xl font-bold tabular-nums mt-0.5">300,00 $</div>
          <div className="text-xs text-mf-text-3">le 2 sept., à 9 h 14</div>
        </div>
        <div>
          <Etiquette>Travaux inscrits</Etiquette>
          <div className="font-mono text-xl font-bold tabular-nums mt-0.5 text-mf-red">500,00 $</div>
          <div className="text-xs text-mf-text-3">2 lignes ajoutées depuis</div>
        </div>
      </div>
      <div className="mx-5 mb-5 border border-mf-red bg-mf-red-soft px-3 py-2.5 text-[13px] leading-snug text-mf-text">
        <div className="font-semibold text-mf-red">Facture refusée</div>
        Le total des travaux dépasse l&apos;évaluation acceptée par le client. Faites accepter une réévaluation
        complémentaire avant de facturer.
      </div>
    </div>
  );
}

/** Facture émise, et le rapport trimestriel pour le comptable. */
export function MaquetteFacture({ className = "" }: { className?: string }) {
  const lignes = [
    ["Plaquettes de frein avant", "Neuve", "89,95 $"],
    ["Remplacement plaquettes", "1,5 h", "187,50 $"],
  ];
  return (
    <div className={`relative ${className}`} aria-hidden>
      <div className="bg-white text-[#16212a] border border-mf-border p-5">
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-[#e3e0d8]">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-wide">Garage Lavoie</div>
            <div className="text-[10.5px] text-[#5c666e] leading-relaxed mt-0.5">
              TPS : 123456789 RT0001
              <br />
              TVQ : 1234567890 TQ0001
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5 text-[13px] font-bold uppercase tracking-wide">
              <Receipt className="w-3.5 h-3.5" /> Facture
            </div>
            <div className="font-mono text-[11px] text-[#5c666e]">FA-0002</div>
          </div>
        </div>
        <div className="py-2 text-[12px] divide-y divide-[#eeece6]">
          {lignes.map(([d, e, m]) => (
            <div key={d} className="py-1.5 grid grid-cols-[1fr_auto_auto] gap-3">
              <span>{d}</span>
              <span className="text-[#5c666e]">{e}</span>
              <span className="font-mono tabular-nums text-right w-16">{m}</span>
            </div>
          ))}
        </div>
        <div className="ml-auto w-48 text-[12px] border-t border-[#e3e0d8] pt-2 flex flex-col gap-1">
          {[
            ["Avant taxes", "277,45 $"],
            ["TPS (5 %)", "13,87 $"],
            ["TVQ (9,975 %)", "27,68 $"],
          ].map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-[#5c666e]">{l}</span>
              <span className="font-mono tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold text-[13px] border-t border-[#e3e0d8] pt-1 mt-0.5">
            <span>Total</span>
            <span className="font-mono tabular-nums">319,00 $</span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 sm:-left-8 bg-mf-surface border border-mf-border px-3 py-2.5 flex items-center gap-3 text-mf-text">
        <FileSpreadsheet className="w-5 h-5 text-mf-success shrink-0" />
        <div>
          <div className="text-[12px] font-semibold leading-tight">Rapport T3 · juil. à sept.</div>
          <div className="text-[11px] text-mf-text-3">Exporté pour le comptable (CSV)</div>
        </div>
      </div>
    </div>
  );
}
