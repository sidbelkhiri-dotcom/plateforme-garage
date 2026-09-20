"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
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
export default function TelephoneDemo({ className = "" }: { className?: string }) {
  const reduit = useReducedMotion();
  const conteneur = useRef<HTMLDivElement>(null);
  const visible = useInView(conteneur, { once: true, margin: "-120px" });
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
      window.setTimeout(() => setPressee(true), 1100),
      window.setTimeout(() => {
        setPressee(false);
        setApprouve(true);
      }, 1380),
    ];
    let arreter: (() => void) | undefined;
    const depart = window.setTimeout(() => {
      const commande = animate(0, MONTANT, {
        duration: 0.7,
        ease: [0.2, 0.8, 0.2, 1],
        onUpdate: (v) => setMontant(v),
      });
      arreter = () => commande.stop();
    }, 1380);
    return () => {
      minuteries.forEach(clearTimeout);
      clearTimeout(depart);
      arreter?.();
    };
  }, [visible, reduit]);

  return (
    <div ref={conteneur} className={className}>
      <MaquetteTelephone approuve={approuve} pressee={pressee} montantApprouve={argent(montant)} />
    </div>
  );
}
