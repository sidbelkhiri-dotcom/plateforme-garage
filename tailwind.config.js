/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tokens de marque MECAFORCE — voir app/globals.css (:root) et
      // BRAND.md. Chaque valeur lit une variable CSS, donc bascule
      // automatiquement entre mode sombre (défaut) et mode clair
      // ([data-theme="light"]) sans qu'aucun composant n'ait à savoir
      // dans quel mode il est.
      colors: {
        "mf-bg": "var(--mf-bg)",
        "mf-surface": "var(--mf-surface)",
        "mf-surface-2": "var(--mf-surface-2)",
        "mf-surface-3": "var(--mf-surface-3)",
        "mf-border": "var(--mf-border)",
        "mf-border-strong": "var(--mf-border-strong)",
        "mf-text": "var(--mf-text)",
        "mf-text-2": "var(--mf-text-2)",
        "mf-text-3": "var(--mf-text-3)",
        "mf-blue": "var(--mf-blue)",
        "mf-blue-hover": "var(--mf-blue-hover)",
        "mf-blue-soft": "var(--mf-blue-soft)",
        "mf-navy": "var(--mf-navy)",
        "mf-red": "var(--mf-red)",
        "mf-red-hover": "var(--mf-red-hover)",
        "mf-red-soft": "var(--mf-red-soft)",
        "mf-success": "var(--mf-success)",
        "mf-success-soft": "var(--mf-success-soft)",
        "mf-warning": "var(--mf-warning)",
        "mf-warning-soft": "var(--mf-warning-soft)",
        "mf-danger": "var(--mf-danger)",
        "mf-info": "var(--mf-info)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-saira)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "mf-sm": "var(--mf-radius-sm)",
        "mf-md": "var(--mf-radius-md)",
        "mf-lg": "var(--mf-radius-lg)",
        "mf-pill": "var(--mf-radius-pill)",
      },
      boxShadow: {
        "mf-sm": "var(--mf-shadow-sm)",
        "mf-md": "var(--mf-shadow-md)",
        "mf-lg": "var(--mf-shadow-lg)",
      },
    },
  },
  plugins: [],
};
