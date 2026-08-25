import type { Metadata, Viewport } from "next";
import { Inter, Saira } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ToastProvider from "@/components/ui/ToastProvider";

// Auto-hébergées par Next au build (next/font) — aucun appel réseau à
// Google au chargement, donc rien à ajouter au CSP existant.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const saira = Saira({
  subsets: ["latin"],
  weight: ["700", "900"],
  variable: "--font-saira",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MECAFORCE SERVICE",
  description: "Plateforme interne de gestion pour garage mécanique",
};

// mf-bg (sombre, mode principal) — la barre d'adresse mobile suit la
// marque même quand la page n'a pas fini de charger le CSS.
export const viewport: Viewport = {
  themeColor: "#060b16",
};

// Applique le thème AVANT le premier rendu (script bloquant, minuscule) —
// sinon un utilisateur en mode clair verrait un flash sombre à chaque
// chargement de page. Pas de bascule visible tant que la Phase 3 n'a pas
// posé l'interrupteur dans la barre latérale ; par défaut : sombre
// (« mode principal » du système de marque), sauf choix explicite
// mémorisé en localStorage.
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
    <html lang="fr" className={`${inter.variable} ${saira.variable}`}>
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
