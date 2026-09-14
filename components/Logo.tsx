import LogoMark from "./LogoMark";

// Le symbole tient la place du G : il est lui-même une lettre, pas un
// badge qui en contiendrait une, donc « symbole + aragenda » se lit bien
// « Garagenda ». Les deux ne se dissocient jamais — séparé du mot, le
// symbole reste un G, mais le mot seul deviendrait « aragenda ».
export default function Logo({
  height = 20,
  metal = "or",
  className = "",
}: {
  height?: number;
  /** Or par défaut, y compris sur la barre latérale encre : depuis la
   *  palette « Denim et laiton », le laiton est l'accent de la marque.
   *  L'argent reste disponible pour un fond où l'or manquerait de contraste. */
  metal?: "or" | "argent";
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: height * 0.16 }}>
      <LogoMark size={height * 1.15} metal={metal} />
      <span
        className="font-display font-bold tracking-tight"
        style={{ fontSize: height, lineHeight: 1 }}
      >
        aragenda
      </span>
    </span>
  );
}
