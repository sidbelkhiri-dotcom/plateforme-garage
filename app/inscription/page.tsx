"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Champ from "@/components/ui/Champ";
import Bouton from "@/components/ui/Bouton";
import CadreAuth, { MessageAuth } from "@/components/auth/CadreAuth";
import ChampMotDePasse from "@/components/auth/ChampMotDePasse";

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
  const [renvoi, setRenvoi] = useState<"envoi" | "envoye" | null>(null);

  // Sans emailRedirectTo, Supabase renvoie le lien de confirmation vers son
  // « Site URL » — localhost sur le projet de dev, donc un lien mort pour
  // un vrai garage. La route /auth/confirmation reçoit désormais le lien.
  const redirection = () => `${window.location.origin}/auth/confirmation`;

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
      email: email.trim(),
      password,
      options: {
        data: { nom: nom.trim(), nom_garage: nomGarage.trim() },
        emailRedirectTo: redirection(),
      },
    });

    setLoading(false);
    if (error) {
      setError(
        error.message.includes("already registered") || error.message.includes("already been registered")
          ? "Un compte existe déjà avec ce courriel."
          : error.status === 429
            ? "Trop de tentatives. Patientez quelques minutes avant de réessayer."
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

  async function renvoyer() {
    setRenvoi("envoi");
    await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirection() } });
    setRenvoi("envoye");
  }

  if (inscrit) {
    return (
      <CadreAuth
        titre="Vérifiez vos courriels"
        pied={
          <Link href="/login" className="font-semibold text-mf-blue hover:underline">
            Retour à la connexion
          </Link>
        }
      >
        <div className="flex gap-3">
          <MailCheck className="w-6 h-6 shrink-0 text-mf-blue" aria-hidden />
          <div className="text-sm text-mf-text flex flex-col gap-3">
            <p>
              Nous avons envoyé un lien de confirmation à <strong className="break-all">{email.trim()}</strong>. Cliquez
              dessus pour ouvrir {nomGarage.trim() ? <strong>{nomGarage.trim()}</strong> : "votre garage"}.
            </p>
            <p className="text-mf-text-2">Rien reçu après quelques minutes ? Regardez dans les courriels indésirables.</p>
            {renvoi === "envoye" ? (
              <p className="text-mf-text-2">Nouveau courriel envoyé.</p>
            ) : (
              <Bouton variante="secondaire" onClick={renvoyer} enEnvoi={renvoi === "envoi"} className="self-start">
                Renvoyer le courriel
              </Bouton>
            )}
          </div>
        </div>
      </CadreAuth>
    );
  }

  return (
    <CadreAuth
      titre="Créez votre garage"
      sousTitre="Évaluations écrites, bons de travail et factures avec TPS et TVQ, au même endroit."
      pied={
        <>
          Déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-mf-blue hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      {error && <MessageAuth ton="erreur">{error}</MessageAuth>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Champ
          label="Nom du garage"
          name="nom_garage"
          autoComplete="organization"
          required
          marquerRequis={false}
          value={nomGarage}
          onChange={(e) => setNomGarage(e.target.value)}
        />
        <Champ
          label="Votre nom"
          name="nom"
          autoComplete="name"
          required
          marquerRequis={false}
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
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
        <ChampMotDePasse
          label="Mot de passe"
          name="password"
          autoComplete="new-password"
          aide="8 caractères minimum."
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Bouton type="submit" enEnvoi={loading} className="w-full mt-1">
          {loading ? "Création…" : "Créer mon garage"}
        </Bouton>
        <p className="text-xs text-mf-text-3 leading-relaxed">
          En créant votre garage, vous confiez à Garagenda les renseignements du compte et ceux de vos clients, qu&apos;il
          héberge pour vous.{" "}
          <Link href="/confidentialite" target="_blank" className="font-semibold text-mf-blue underline underline-offset-2">
            Politique de confidentialité
          </Link>
        </p>
      </form>
    </CadreAuth>
  );
}
