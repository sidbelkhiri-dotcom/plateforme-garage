"use client";

import { useState } from "react";

type EtatEnvoi = "repos" | "envoi" | "succes" | "erreur";

// Hook partagé par tous les formulaires CRUD : état d'envoi, erreurs
// Supabase affichées (jamais avalées, D15), rien de plus.
export function useFormulaire<T extends Record<string, any>>(valeursInitiales: T) {
  const [valeurs, setValeurs] = useState<T>(valeursInitiales);
  const [etat, setEtat] = useState<EtatEnvoi>("repos");
  const [erreur, setErreur] = useState<string | null>(null);

  function definir<K extends keyof T>(champ: K, valeur: T[K]) {
    setValeurs((v) => ({ ...v, [champ]: valeur }));
  }

  async function soumettre(
    action: (valeurs: T) => Promise<{ error: { message: string } | null }>
  ): Promise<boolean> {
    setEtat("envoi");
    setErreur(null);
    const { error } = await action(valeurs);
    if (error) {
      setErreur(error.message);
      setEtat("erreur");
      return false;
    }
    setEtat("succes");
    return true;
  }

  function reinitialiser() {
    setValeurs(valeursInitiales);
    setEtat("repos");
    setErreur(null);
  }

  return {
    valeurs,
    definir,
    soumettre,
    reinitialiser,
    erreur,
    enEnvoi: etat === "envoi",
  };
}
