import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applique lui-même le masque arrondi — fond plein jusqu'aux bords,
// jamais transparent (rendu en noir par endroits sinon).
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#060b16",
        }}
      >
        <svg width="180" height="180" viewBox="0 0 32 32">
          <path d="M8 26 L13 26 L22 6 L17 6 Z" fill="#0b5be8" />
          <path d="M17 26 L22 26 L29 6 L24 6 Z" fill="#e01b24" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
