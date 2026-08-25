"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

// Sombre = mode principal, par défaut (voir app/layout.tsx, script
// bloquant + BRAND.md). Cet interrupteur est la seule façon de passer
// au mode clair, mémorisée en localStorage.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const actuel = document.documentElement.getAttribute("data-theme");
    setTheme(actuel === "light" ? "light" : "dark");
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
      className="w-full flex items-center gap-3 px-5 py-3 text-sm text-mf-text-2 hover:bg-mf-surface-2 hover:text-mf-text transition-colors min-h-[44px]"
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      {theme === "dark" ? "Mode clair" : "Mode sombre"}
    </button>
  );
}
