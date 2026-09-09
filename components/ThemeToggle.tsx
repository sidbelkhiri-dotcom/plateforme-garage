"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Clair = mode principal, par défaut (voir app/layout.tsx, script
// bloquant). Cet interrupteur est la seule façon de passer au mode
// sombre, mémorisée en localStorage.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const actuel = document.documentElement.getAttribute("data-theme");
    setTheme(actuel === "dark" ? "dark" : "light");
  }, []);

  function basculer() {
    const suivant = theme === "dark" ? "light" : "dark";
    setTheme(suivant);
    localStorage.setItem("mf-theme", suivant);
    document.documentElement.setAttribute("data-theme", suivant);
  }

  return (
    <button
      onClick={basculer}
      className="w-full flex items-center gap-3 px-5 py-3 text-sm text-mf-sidebar-text-2 hover:bg-white/5 hover:text-mf-sidebar-text transition-colors min-h-[44px]"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {theme === "dark" ? "Mode clair" : "Mode sombre"}
    </button>
  );
}
