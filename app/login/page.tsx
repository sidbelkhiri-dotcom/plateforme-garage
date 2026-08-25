"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandStripes from "@/components/ui/BrandStripes";
import Logo from "@/components/Logo";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <FormulaireConnexion />
    </Suspense>
  );
}

function FormulaireConnexion() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirigé ici par le middleware quand le compte vient d'être désactivé
  // (audit du 18 août, point 15) — un message clair plutôt qu'un
  // "courriel ou mot de passe incorrect" qui laisserait croire à une
  // erreur de saisie.
  useEffect(() => {
    if (searchParams.get("desactive") === "1") {
      setError("Ce compte a été désactivé. Contactez l'administrateur du garage.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Courriel ou mot de passe incorrect.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-mf-bg overflow-hidden">
      <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.06]">
        <BrandStripes size={640} />
      </div>
      <form
        onSubmit={handleSubmit}
        className="relative bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-8 w-full max-w-sm"
      >
        <div className="mb-6">
          <Logo height={22} />
        </div>
        <label className="flex flex-col gap-1 text-sm mb-3">
          <span className="font-medium text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">
            Courriel
          </span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft min-h-[44px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm mb-4">
          <span className="font-medium text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">
            Mot de passe
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft min-h-[44px]"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-mf-red mb-3">
            {error}
          </p>
        )}
        <button
          disabled={loading}
          className="w-full bg-mf-blue hover:bg-mf-blue-hover disabled:opacity-50 text-white rounded-mf-sm py-2 text-sm font-semibold min-h-[44px] transition-colors"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
