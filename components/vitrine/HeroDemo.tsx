"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MaquetteBon, MaquetteFactureCompacte } from "./Maquettes";
import TelephoneDemo from "./TelephoneDemo";

// Le héros du site vitrine : la promesse du titre, jouée.
//
// « Du premier appel à la facture » — alors on montre exactement ce
// chemin, en trois temps d'environ cinq secondes, une seule fois :
//   1. la réception remplit le bon de travail, ligne par ligne ;
//   2. le téléphone du client arrive, il approuve la réparation ;
//   3. la facture monte, TPS et TVQ comprises.
//
// Trois règles tenues : rien ne bloque le défilement, l'état final est
// lisible et stable (c'est lui qui compte, pas le mouvement), et
// « Réduire les animations » affiche la scène déjà terminée.
//
// Sous 1024 px, seul le téléphone reste : trois documents empilés sur un
// écran de téléphone ne se lisent plus, et le client approuvant sa
// réparation est le moment qui vend le mieux.

const T_BON = 0.15;
const T_TELEPHONE = 1.25;
const T_FACTURE = 3.9;

export default function HeroDemo() {
  const reduit = useReducedMotion();
  const entree = (delai: number, x = 0, y = 18) =>
    reduit
      ? {}
      : {
          initial: { opacity: 0, x, y },
          animate: { opacity: 1, x: 0, y: 0 },
          transition: { delay: delai, duration: 0.55, ease: [0.16, 0.8, 0.3, 1] as const },
        };

  return (
    <div className="relative mx-auto w-full flex justify-center lg:block lg:h-[580px]">
      <motion.div className="hidden lg:block absolute left-0 top-0 w-[290px] z-10" {...entree(T_BON)}>
        <MaquetteBon anime={!reduit} delai={T_BON + 0.35} />
      </motion.div>

      <motion.div className="lg:absolute lg:-right-6 xl:right-0 lg:top-[58px] lg:z-30" {...entree(T_TELEPHONE, 28, 0)}>
        <TelephoneDemo demarrage="chargement" delaiMs={reduit ? 0 : T_TELEPHONE * 1000} />
      </motion.div>

      {/* La facture sort de sous le bon, comme une feuille qu'on tire d'une pile. */}
      <motion.div
        className="hidden lg:block absolute left-[22px] top-[384px] w-[264px] z-20"
        {...entree(T_FACTURE, 0, 34)}
      >
        <MaquetteFactureCompacte />
      </motion.div>
    </div>
  );
}
