"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

// Animations du site vitrine, et d'elles seules : dans l'application, un
// écran qui bouge ralentit le travail au comptoir.
//
// Trois règles tenues ici :
//   - rien ne se joue en boucle, tout se joue une fois ;
//   - la page est lisible sans JavaScript et sans animation — on anime une
//     opacité et quelques pixels, jamais l'apparition d'un contenu ;
//   - « Réduire les animations » du système coupe tout (useReducedMotion),
//     et le contenu s'affiche alors immédiatement, à sa place définitive.

// Assez franc pour se voir, assez court pour ne jamais retarder la lecture :
// une première version à 14 px et 0,5 s passait inaperçue.
const MONTEE: Variants = {
  repos: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.16, 0.8, 0.3, 1] } },
};

/** Révèle son contenu quand il entre à l'écran, une seule fois. */
export function Apparition({
  children,
  delai = 0,
  className = "",
}: {
  children: React.ReactNode;
  delai?: number;
  className?: string;
}) {
  const reduit = useReducedMotion();
  if (reduit) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={MONTEE}
      initial="repos"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay: delai }}
    >
      {children}
    </motion.div>
  );
}

/** Enchaîne l'apparition de ses enfants directs, au chargement de la page. */
export function Sequence({ children, className = "", pas = 0.12 }: { children: React.ReactNode; className?: string; pas?: number }) {
  const reduit = useReducedMotion();
  if (reduit) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="repos"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: pas, delayChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

/** Un élément d'une Sequence. */
export function Etape({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduit = useReducedMotion();
  if (reduit) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={MONTEE}>
      {children}
    </motion.div>
  );
}
