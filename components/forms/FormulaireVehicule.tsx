"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMarques, useModeles, useAnnees } from "@/lib/useMarquesModeles";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

const AUTRE = "__autre__";

export type VehiculeValeurs = {
  marque: string;
  modele: string;
  annee: string;
  plaque: string;
  vin: string;
  couleur: string;
};

const VALEURS_VIDES: VehiculeValeurs = {
  marque: "",
  modele: "",
  annee: "",
  plaque: "",
  vin: "",
  couleur: "",
};

// Messages clairs pour les deux index uniques partiels du schéma
// (idx_vehicules_plaque_uniq, idx_vehicules_vin_uniq) — sans avaler
// l'erreur Supabase brute pour autant (D15) : on la remplace par une
// phrase compréhensible, on ne la cache pas.
function messageErreurLisible(erreur: string): string {
  if (erreur.includes("idx_vehicules_plaque_uniq")) {
    return "Cette plaque est déjà utilisée par un autre véhicule.";
  }
  if (erreur.includes("idx_vehicules_vin_uniq")) {
    return "Ce NIV (VIN) est déjà utilisé par un autre véhicule.";
  }
  return erreur;
}

export default function FormulaireVehicule({
  clientId,
  vehiculeId,
  valeursInitiales,
  onSucces,
  onAnnuler,
}: {
  clientId: string;
  vehiculeId?: string;
  valeursInitiales?: Partial<VehiculeValeurs>;
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<VehiculeValeurs>({
    ...VALEURS_VIDES,
    ...valeursInitiales,
  });

  // En modification, on garde la saisie libre par défaut : forcer un
  // véhicule existant dans le menu déroulant risquerait de perdre une
  // valeur absente de la base de référence moissonnée.
  const [marqueLibre, setMarqueLibre] = useState(!!valeursInitiales?.marque);
  const [modeleLibre, setModeleLibre] = useState(!!valeursInitiales?.marque);
  const [anneeLibre, setAnneeLibre] = useState(!!valeursInitiales?.marque);
  const marques = useMarques();
  const modeles = useModeles(marqueLibre ? "" : valeurs.marque);
  const annees = useAnnees(marqueLibre ? "" : valeurs.marque, modeleLibre ? "" : valeurs.modele);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      client_id: clientId,
      marque: valeurs.marque.trim(),
      modele: valeurs.modele || null,
      annee: valeurs.annee ? Number(valeurs.annee) : null,
      plaque: valeurs.plaque || null,
      vin: valeurs.vin || null,
      couleur: valeurs.couleur || null,
    };
    const reussi = await soumettre(async () => {
      const { error } = vehiculeId
        ? await supabase.from("vehicules").update(donnees).eq("id", vehiculeId)
        : await supabase.from("vehicules").insert(donnees);
      return { error: error ? { message: messageErreurLisible(error.message) } : null };
    });
    if (reussi) onSucces();
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {marqueLibre ? (
          <Champ label="Marque" required value={valeurs.marque} onChange={(e) => definir("marque", e.target.value)} />
        ) : (
          <Selecteur
            label="Marque"
            required
            value={valeurs.marque}
            onChange={(e) => {
              if (e.target.value === AUTRE) {
                setMarqueLibre(true);
                definir("marque", "");
              } else {
                definir("marque", e.target.value);
                definir("modele", "");
                definir("annee", "");
              }
            }}
          >
            <option value="">— Choisir —</option>
            {marques.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={AUTRE}>Autre (préciser)…</option>
          </Selecteur>
        )}

        {marqueLibre || modeleLibre ? (
          <Champ label="Modèle" value={valeurs.modele} onChange={(e) => definir("modele", e.target.value)} />
        ) : (
          <Selecteur
            label="Modèle"
            value={valeurs.modele}
            disabled={!valeurs.marque}
            onChange={(e) => {
              if (e.target.value === AUTRE) {
                setModeleLibre(true);
                definir("modele", "");
              } else {
                definir("modele", e.target.value);
                definir("annee", "");
              }
            }}
          >
            <option value="">{valeurs.marque ? "— Choisir —" : "— Choisir une marque d'abord —"}</option>
            {modeles.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value={AUTRE}>Autre (préciser)…</option>
          </Selecteur>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {marqueLibre || modeleLibre || anneeLibre ? (
          <Champ
            label="Année"
            type="number"
            value={valeurs.annee}
            onChange={(e) => definir("annee", e.target.value)}
          />
        ) : (
          <Selecteur
            label="Année"
            value={valeurs.annee}
            disabled={!valeurs.modele}
            onChange={(e) => {
              if (e.target.value === AUTRE) {
                setAnneeLibre(true);
                definir("annee", "");
              } else {
                definir("annee", e.target.value);
              }
            }}
          >
            <option value="">{valeurs.modele ? "— Choisir —" : "— Choisir un modèle d'abord —"}</option>
            {annees.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value={AUTRE}>Autre (préciser)…</option>
          </Selecteur>
        )}
        <Champ label="Couleur" value={valeurs.couleur} onChange={(e) => definir("couleur", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Plaque" value={valeurs.plaque} onChange={(e) => definir("plaque", e.target.value)} />
        <Champ label="NIV (VIN)" value={valeurs.vin} onChange={(e) => definir("vin", e.target.value)} />
      </div>
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-1">
        <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton type="submit" enEnvoi={enEnvoi}>
          {vehiculeId ? "Enregistrer" : "Ajouter le véhicule"}
        </Bouton>
      </div>
    </form>
  );
}
