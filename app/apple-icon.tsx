import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applique lui-même le masque arrondi — fond plein jusqu'aux bords,
// jamais transparent (rendu en noir par endroits sinon). Le G du
// symbole est évidé sur ce même fond encre.
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
          background: "#0e1f2b",
        }}
      >
        <svg width="116" height="116" viewBox="0 0 48 48">
          <polygon points="24,0 44.78,12 44.78,36 24,48 3.22,36 3.22,12" fill="#f7f6f2" />
          <circle cx="24" cy="24" r="15" fill="#0e1f2b" />
          <circle cx="24" cy="24" r="8" fill="#f7f6f2" />
          <rect x="24" y="19" width="18" height="10" fill="#f7f6f2" />
          <rect x="26" y="21.5" width="13" height="5" fill="#0e1f2b" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
