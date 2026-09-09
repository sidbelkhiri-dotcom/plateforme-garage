// Le symbole est une image matricielle et non un dessin vectoriel : le
// rendu métallique brossé ne se reproduit pas en SVG. Les deux fichiers
// viennent du visuel d'origine, découpés au plus juste et centrés sur un
// carré transparent de 256 px — soit près de dix fois la taille
// d'affichage dans la barre latérale, donc net sur écran Retina.
//
// Conséquence assumée : la couleur du symbole n'est plus modifiable
// depuis le code, et il faut un fichier par métal.
export default function LogoMark({
  size = 24,
  metal = "or",
  className = "",
}: {
  size?: number;
  /** Or par défaut, pour les fonds clairs ; argent sur fond foncé. */
  metal?: "or" | "argent";
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo-${metal}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size }}
    />
  );
}
