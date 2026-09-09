import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ToastProvider from "@/components/ui/ToastProvider";

// Auto-hébergées par Next au build (next/font) — aucun appel réseau à
// Google au chargement, donc rien à ajouter au CSP existant.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plateforme Garage",
  description: "Plateforme de gestion pour garages mécaniques",
};

// mf-bg (clair, mode principal — direction « Bleu de travail ») — la
// barre d'adresse mobile suit la marque même quand la page n'a pas fini
// de charger le CSS.
export const viewport: Viewport = {
  themeColor: "#f7f6f2",
};

// Applique le thème AVANT le premier rendu (script bloquant, minuscule) —
// sinon un utilisateur en mode sombre verrait un flash clair à chaque
// chargement de page. Par défaut : clair (« mode principal » du système
// de marque), sauf choix explicite mémorisé en localStorage.
const scriptTheme = `
(function () {
  try {
    var t = localStorage.getItem('mf-theme');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${plex.variable} ${archivo.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTheme }} />
      </head>
      <body className="font-sans text-mf-text bg-mf-bg">
        <ToastProvider>
          <div className="flex flex-col md:flex-row min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
