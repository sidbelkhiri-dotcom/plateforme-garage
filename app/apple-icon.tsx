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
        <svg width="124" height="124" viewBox="0 0 100 100">
          <polygon points="8.43,26 50,2 50,12 17.1,31" fill="#4A6B85" />
          <polygon points="50,2 91.57,26 82.9,31 50,12" fill="#2E4E66" />
          <polygon points="91.57,26 91.57,74 82.9,69 82.9,31" fill="#1A3348" />
          <polygon points="91.57,74 50,98 50,88 82.9,69" fill="#14293A" />
          <polygon points="50,98 8.43,74 17.1,69 50,88" fill="#22405A" />
          <polygon points="8.43,74 8.43,26 17.1,31 17.1,69" fill="#3C5C76" />
          <polygon points="50,12 82.9,31 82.9,69 50,88 17.1,69 17.1,31" fill="#16324A" />
          <polygon points="50,18 77.71,34 77.71,66 50,82 22.29,66 22.29,34" fill="#D9B84A" />
          <polygon points="50,32 65.59,41 65.59,59 50,68 34.41,59 34.41,41" fill="#16324A" />
          <rect x="50" y="43" width="30" height="14" fill="#16324A" />
          <rect x="50" y="46.5" width="27" height="7" fill="#D9B84A" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
