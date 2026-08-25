import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MECAFORCE — Gestion d'atelier",
    short_name: "MECAFORCE",
    description: "Plateforme interne de gestion pour garage mécanique",
    start_url: "/",
    display: "standalone",
    background_color: "#060b16",
    theme_color: "#060b16",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
