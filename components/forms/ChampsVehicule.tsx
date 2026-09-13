"use client";

import { useState } from "react";
import { useMarques, useModeles, useAnnees } from "@/lib/useMarquesModeles";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";

const AUTRE = "__autre__";

export type ValeursVehicule = { marque: string; modele: string; annee: string };

// Marque, modèle et année en cascade, pour les formulaires publics.
//
// Sorti de la page d'arrivée au comptoir le jour où la page de demande de
// rendez-vous en a eu besoin : ce sont quatre-vingts lignes de logique —
// catalogue de référence, choix « Autre (préciser) » qui bascule en saisie
// libre, remise à zéro du modèle quand la marque change. Recopiées, elles
// auraient dérivé l'une de l'autre au premier correctif.
//
// `saisieLibre` force les trois champs en saisie libre : le décodage d'un
// NIV peut renvoyer une valeur absente du catalogue.
export default function ChampsVehicule({
  valeurs,
  definir,
  saisieLibre = false,
}: {
  valeurs: ValeursVehicule;
  definir: (champ: keyof ValeursVehicule, valeur: string) => void;
  saisieLibre?: boolean;
}) {
  const [marqueLibre, setMarqueLibre] = useState(false);
  const [modeleLibre, setModeleLibre] = useState(false);
  const [anneeLibre, setAnneeLibre] = useState(false);

  const marqueEnSaisie = saisieLibre || marqueLibre;
  const modeleEnSaisie = saisieLibre || marqueLibre || modeleLibre;
  const anneeEnSaisie = saisieLibre || marqueLibre || modeleLibre || anneeLibre;

  const marques = useMarques();
  const modeles = useModeles(marqueEnSaisie ? "" : valeurs.marque);
  const annees = useAnnees(marqueEnSaisie ? "" : valeurs.marque, modeleEnSaisie ? "" : valeurs.modele);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {marqueEnSaisie ? (
          <Champ label="Marque" value={valeurs.marque} onChange={(e) => definir("marque", e.target.value)} />
        ) : (
          <Selecteur
            label="Marque"
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

        {modeleEnSaisie ? (
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

      {anneeEnSaisie ? (
        <Champ
          label="Année"
          type="number"
          inputMode="numeric"
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
    </>
  );
}
