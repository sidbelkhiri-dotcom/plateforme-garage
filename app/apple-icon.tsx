import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applique lui-même le masque arrondi — fond plein jusqu'aux bords,
// jamais transparent (rendu en noir par endroits sinon). Le fond étant
// connu et uni, les creux du G sont peints en encre plutôt que masqués :
// next/og ne rend pas les masques SVG de façon fiable.
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
        <svg width="132" height="132" viewBox="0 0 100 100">
          <polygon points="50,4 89.84,27 89.84,73 50,96 10.16,73 10.16,27" fill="#D9B85C" />
          <polygon points="50,24 72.52,37 72.52,63 50,76 27.48,63 27.48,37" fill="#10243A" />
          <rect x="60" y="36" width="40" height="16" fill="#10243A" />
          <rect x="56" y="52" width="44" height="11" fill="#D9B85C" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
