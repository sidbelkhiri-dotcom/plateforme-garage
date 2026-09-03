"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BrandStripes from "@/components/ui/BrandStripes";
import Logo from "@/components/Logo";

export default function InscriptionPage() {
  return (
    <Suspense fallback={null}>
      <FormulaireInscription />
    </Suspense>
  );
}

function FormulaireInscription() {
  const router = useRouter();
  const supabase = createClient();
  const [nom, setNom] = useState("");
  const [nomGarage, setNomGarage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inscrit, setInscrit] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nom, nom_garage: nomGarage } },
    });

    setLoading(false);
    if (error) {
      setError(
        error.message.includes("already registered") || error.message.includes("already been registered")
          ? "Un compte existe déjà avec ce courriel."
          : "Impossible de créer le compte. Vérifiez les informations et réessayez."
      );
      return;
    }

    // Selon la configuration Supabase Auth, la confirmation par courriel
    // peut être exigée avant qu'une session existe — dans ce cas data.session
    // est null et il faut attendre que le lien reçu soit cliqué.
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      setInscrit(true);
    }
  }

  if (inscrit) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-mf-bg overflow-hidden">
        <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.06]">
          <BrandStripes size={640} />
        </div>
        <div className="relative bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-8 w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <Logo height={22} />
          </div>
          <p className="text-sm text-mf-text">
            Un courriel de confirmation a été envoyé à <strong>{email}</strong>. Cliquez sur le lien qu'il contient pour
            activer votre compte, puis connectez-vous.
          </p>
        </div>
      </div>
    );
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
            Nom du garage
          </span>
          <input
            type="text"
            name="nom_garage"
            required
            value={nomGarage}
            onChange={(e) => setNomGarage(e.target.value)}
            className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft min-h-[44px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm mb-3">
          <span className="font-medium text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">
            Votre nom
          </span>
          <input
            type="text"
            name="nom"
            autoComplete="name"
            required
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft min-h-[44px]"
          />
        </label>
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
            autoComplete="new-password"
            required
            minLength={8}
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
          {loading ? "Création..." : "Créer mon garage"}
        </button>
        <p className="text-center text-xs text-mf-text-3 mt-4">
          Déjà un compte ?{" "}
          <a href="/login" className="text-mf-blue hover:underline">
            Se connecter
          </a>
        </p>
      </form>
    </div>
  );
}
