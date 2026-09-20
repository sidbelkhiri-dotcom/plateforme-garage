"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { MaquetteTelephone } from "./Maquettes";

const MONTANT = 289.95;
const argent = (n: number) => new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

// La maquette du téléphone rejoue, une seule fois, le geste que vend le
// produit : le client regarde la photo, appuie sur « Approuver », et le
// total approuvé grimpe. Montrer vaut mieux qu'expliquer — mais sans
// boucle, sinon la page clignote dans le dos du lecteur.
//
// « Réduire les animations » : la maquette s'affiche directement dans son
// état final approuvé, sans mouvement ni compteur.
export default function TelephoneDemo({
  className = "",
  demarrage = "vue",
  delaiMs = 0,
}: {
  className?: string;
  /** Attente avant que le client n'appuie, pour s'accorder au reste du héros. */
  delaiMs?: number;
  /**
   * « chargement » pour la maquette du héros : elle n'est jamais assez au
   * centre de l'écran pour qu'un déclenchement au défilement se produise, et
   * c'est pourtant la première chose que voit un visiteur.
   */
  demarrage?: "chargement" | "vue";
}) {
  const reduit = useReducedMotion();
  const conteneur = useRef<HTMLDivElement>(null);
  const dansLEcran = useInView(conteneur, { once: true, margin: "-60px" });
  const visible = demarrage === "chargement" || dansLEcran;
  const [pressee, setPressee] = useState(false);
  const [approuve, setApprouve] = useState(false);
  const [montant, setMontant] = useState(0);

  useEffect(() => {
    if (reduit) {
      setApprouve(true);
      setMontant(MONTANT);
      return;
    }
    if (!visible) return;
    const minuteries = [
      window.setTimeout(() => setPressee(true), delaiMs + 1500),
      window.setTimeout(() => {
        setPressee(false);
        setApprouve(true);
      }, delaiMs + 1820),
    ];
    let arreter: (() => void) | undefined;
    const depart = window.setTimeout(() => {
      const commande = animate(0, MONTANT, {
        duration: 0.9,
        ease: [0.2, 0.8, 0.2, 1],
        onUpdate: (v) => setMontant(v),
      });
      arreter = () => commande.stop();
    }, delaiMs + 1820);
    return () => {
      minuteries.forEach(clearTimeout);
      clearTimeout(depart);
      arreter?.();
    };
  }, [visible, reduit, delaiMs]);

  return (
    <div ref={conteneur} className={className}>
      <MaquetteTelephone
        approuve={approuve}
        pressee={pressee}
        montantApprouve={
          <motion.span
            className="inline-block"
            animate={approuve && !reduit ? { scale: [1, 1.22, 1] } : { scale: 1 }}
            transition={{ duration: 0.9, times: [0, 0.35, 1], ease: "easeOut" }}
          >
            {argent(montant)}
          </motion.span>
        }
      />
    </div>
  );
}
