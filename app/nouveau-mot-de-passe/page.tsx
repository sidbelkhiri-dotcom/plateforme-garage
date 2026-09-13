"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Bouton from "@/components/ui/Bouton";
import CadreAuth, { MessageAuth } from "@/components/auth/CadreAuth";
import ChampMotDePasse from "@/components/auth/ChampMotDePasse";

// Atteinte par le lien de réinitialisation, après /auth/confirmation qui a
// ouvert la session. Sans session, le middleware renvoie à la connexion.
export default function NouveauMotDePassePage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    if (password.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmation) {
      setErreur("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErreur(
        error.code === "same_password"
          ? "Choisissez un mot de passe différent de l'ancien."
          : "Le mot de passe n'a pas pu être changé. Redemandez un lien et réessayez."
      );
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <CadreAuth titre="Nouveau mot de passe" sousTitre="Choisissez le mot de passe que vous utiliserez désormais.">
      {erreur && <MessageAuth ton="erreur">{erreur}</MessageAuth>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ChampMotDePasse
          label="Nouveau mot de passe"
          name="password"
          autoComplete="new-password"
          aide="8 caractères minimum."
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <ChampMotDePasse
          label="Confirmer"
          name="confirmation"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
        />
        <Bouton type="submit" enEnvoi={loading} className="w-full">
          {loading ? "Enregistrement…" : "Enregistrer le mot de passe"}
        </Bouton>
      </form>
    </CadreAuth>
  );
}
