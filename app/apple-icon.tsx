import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applique lui-même le masque arrondi — fond plein jusqu'aux bords,
// jamais transparent (rendu en noir par endroits sinon).
//
// Le symbole est intégré en base64 : next/og s'exécute côté serveur sans
// origine connue, un chemin relatif n'y serait pas résolu.
const symbole = readFileSync(join(process.cwd(), "public", "logo-or.png")).toString("base64");

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
        <img src={`data:image/png;base64,${symbole}`} width={132} height={132} alt="" />
      </div>
    ),
    { ...size }
  );
}
