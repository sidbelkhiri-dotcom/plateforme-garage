import Image from "next/image";

// Affiche le bon fichier logo selon le thème actif (voir la règle
// .mf-logo-sombre / .mf-logo-clair dans app/globals.css) — pas de flash
// au chargement puisque les deux <img> sont dans le DOM, seul le CSS
// bascule l'affichage.
export default function Logo({ height = 20, className = "" }: { height?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ height }}>
      <Image
        src="/logo-fond-sombre.png"
        alt="MECAFORCE SERVICE"
        height={height}
        width={height * 8}
        style={{ height, width: "auto" }}
        className="mf-logo-sombre"
        unoptimized
        priority
      />
      <Image
        src="/logo-fond-clair.png"
        alt="MECAFORCE SERVICE"
        height={height}
        width={height * 6.8}
        style={{ height, width: "auto" }}
        className="mf-logo-clair"
        unoptimized
        priority
      />
    </span>
  );
}
