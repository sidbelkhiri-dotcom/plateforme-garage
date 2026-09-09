import { ImageResponse } from "next/og";
import { SYMBOLE_OR } from "./symbole-or";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applique lui-même le masque arrondi — fond plein jusqu'aux bords,
// jamais transparent (rendu en noir par endroits sinon).
//
// Le symbole vient d'une constante base64 et non d'un fichier : sur
// Vercel, ni public/ ni les fichiers voisins de la route ne sont
// garantis présents dans le système de fichiers de la fonction. Une
// lecture disque au chargement du module a déjà fait tomber TOUT le
// rendu serveur de l'application, pas seulement cette icône.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#10243A",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={SYMBOLE_OR} width={132} height={132} alt="" />
      </div>
    ),
    { ...size }
  );
}
