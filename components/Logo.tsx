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
  /** Or par défaut, pour les fonds clairs ; la barre latérale, toujours
   *  foncée, est la seule à demander l'argent. */
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
