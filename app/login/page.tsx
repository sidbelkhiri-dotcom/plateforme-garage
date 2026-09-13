"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Champ from "@/components/ui/Champ";
import Bouton from "@/components/ui/Bouton";
import CadreAuth, { MessageAuth } from "@/components/auth/CadreAuth";
import ChampMotDePasse from "@/components/auth/ChampMotDePasse";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <FormulaireConnexion />
    </Suspense>
  );
}

type Erreur = { texte: string; nonConfirme?: boolean };

function FormulaireConnexion() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState<Erreur | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [renvoi, setRenvoi] = useState<"envoi" | "envoye" | null>(null);

  useEffect(() => {
    // Redirigé ici par le middleware quand le compte vient d'être désactivé
    // (audit du 18 août, point 15) — un message clair plutôt qu'un
    // "courriel ou mot de passe incorrect" qui laisserait croire à une
    // erreur de saisie.
    if (searchParams.get("desactive") === "1") {
      setErreur({ texte: "Ce compte a été désactivé. Contactez l'administrateur du garage." });
    } else if (searchParams.get("confirme") === "1") {
      setInfo("Votre courriel est confirmé. Connectez-vous pour ouvrir votre garage.");
    } else if (searchParams.get("reinitialise") === "1") {
      setInfo("Mot de passe changé. Connectez-vous avec le nouveau.");
    } else if (searchParams.get("lien") === "expire" || window.location.hash.includes("otp_expired")) {
      setErreur({ texte: "Ce lien a expiré ou a déjà servi. Connectez-vous, ou demandez un nouveau lien." });
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErreur(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      setErreur(traduire(error));
      return;
    }
    router.push("/");
    router.refresh();
  }

  async function renvoyerConfirmation() {
    setRenvoi("envoi");
    await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmation` },
    });
    setRenvoi("envoye");
  }

  return (
    <CadreAuth
      titre="Connexion"
      sousTitre="Accédez aux bons de travail et aux factures de votre garage."
      pied={
        <>
          Nouveau garage ?{" "}
          <Link href="/inscription" className="font-semibold text-mf-blue hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      {info && <MessageAuth ton="succes">{info}</MessageAuth>}
      {erreur && (
        <MessageAuth ton="erreur">
          {erreur.texte}
          {erreur.nonConfirme && (
            <div className="mt-2">
              {renvoi === "envoye" ? (
                <span className="text-mf-text">Nouveau courriel envoyé à {email.trim()}.</span>
              ) : (
                <button
                  type="button"
                  onClick={renvoyerConfirmation}
                  disabled={renvoi === "envoi"}
                  className="font-semibold underline underline-offset-2 hover:no-underline min-h-[44px] disabled:opacity-50"
                >
                  {renvoi === "envoi" ? "Envoi…" : "Renvoyer le courriel de confirmation"}
                </button>
              )}
            </div>
          )}
        </MessageAuth>
      )}
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
        <div className="flex flex-col gap-1">
          <ChampMotDePasse
            label="Mot de passe"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Link
            href={`/mot-de-passe-oublie${email.trim() ? `?courriel=${encodeURIComponent(email.trim())}` : ""}`}
            className="self-end text-xs font-semibold text-mf-blue hover:underline py-2"
          >
            Mot de passe oublié ?
          </Link>
        </div>
        <Bouton type="submit" enEnvoi={loading} className="w-full">
          {loading ? "Connexion…" : "Se connecter"}
        </Bouton>
      </form>
    </CadreAuth>
  );
}

// Chaque refus avait le même message, « courriel ou mot de passe
// incorrect » : un garage qui venait de s'inscrire sans avoir cliqué le
// lien de confirmation retapait son mot de passe en boucle.
function traduire(error: { code?: string; status?: number; name?: string }): Erreur {
  if (error.code === "email_not_confirmed") {
    return {
      texte: "Votre courriel n'est pas encore confirmé. Cliquez sur le lien reçu à l'inscription (vérifiez aussi les indésirables).",
      nonConfirme: true,
    };
  }
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return { texte: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
  }
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return { texte: "Le serveur ne répond pas. Vérifiez votre connexion Internet et réessayez." };
  }
  return { texte: "Courriel ou mot de passe incorrect." };
}
