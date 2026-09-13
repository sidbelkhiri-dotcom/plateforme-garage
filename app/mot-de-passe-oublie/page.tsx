"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Champ from "@/components/ui/Champ";
import Bouton from "@/components/ui/Bouton";
import CadreAuth, { MessageAuth } from "@/components/auth/CadreAuth";

export default function MotDePasseOubliePage() {
  return (
    <Suspense fallback={null}>
      <FormulaireOubli />
    </Suspense>
  );
}

// Jusqu'ici, un propriétaire qui oubliait son mot de passe n'avait aucun
// recours dans l'application : il était enfermé hors de ses propres
// factures.
function FormulaireOubli() {
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState(searchParams.get("courriel") ?? "");
  const [loading, setLoading] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");
  const autreAppareil = searchParams.get("lien") === "autre-appareil";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErreur("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/confirmation?suite=/nouveau-mot-de-passe`,
    });
    setLoading(false);
    // Même réponse qu'un compte existe ou non : la page ne doit pas servir
    // à vérifier quels courriels ont un compte. Seul le blocage temporaire
    // est signalé, sinon l'utilisateur attendrait un courriel qui ne vient pas.
    if (error?.status === 429) {
      setErreur("Trop de demandes. Patientez quelques minutes avant de réessayer.");
      return;
    }
    setEnvoye(true);
  }

  const pied = (
    <Link href="/login" className="font-semibold text-mf-blue hover:underline">
      Retour à la connexion
    </Link>
  );

  if (envoye) {
    return (
      <CadreAuth titre="Vérifiez vos courriels" pied={pied}>
        <p className="text-sm text-mf-text">
          Si un compte existe pour <strong className="break-all">{email.trim()}</strong>, un lien pour choisir un
          nouveau mot de passe vient d'y être envoyé.
        </p>
        <p className="mt-3 text-sm text-mf-text-2">
          Ouvrez-le de préférence sur cet appareil. Rien reçu ? Regardez dans les courriels indésirables.
        </p>
      </CadreAuth>
    );
  }

  return (
    <CadreAuth
      titre="Mot de passe oublié"
      sousTitre="Entrez le courriel de votre compte. Nous vous enverrons un lien pour en choisir un nouveau."
      pied={pied}
    >
      {autreAppareil && (
        <MessageAuth ton="info">
          Le lien a été ouvert sur un autre appareil que celui de la demande. Refaites la demande ici, puis ouvrez le
          courriel sur cet appareil.
        </MessageAuth>
      )}
      {erreur && <MessageAuth ton="erreur">{erreur}</MessageAuth>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Champ
          label="Courriel"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          marquerRequis={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Bouton type="submit" enEnvoi={loading} className="w-full">
          {loading ? "Envoi…" : "Envoyer le lien"}
        </Bouton>
      </form>
    </CadreAuth>
  );
}
