"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMarques, useModeles, useAnnees } from "@/lib/useMarquesModeles";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";
import BrandStripes from "@/components/ui/BrandStripes";
import Logo from "@/components/Logo";

const AUTRE = "__autre__";

type Valeurs = {
  nom: string;
  telephone: string;
  courriel: string;
  adresse: string;
  codePostal: string;
  marque: string;
  modele: string;
  annee: string;
  plainte: string;
};

const VALEURS_VIDES: Valeurs = {
  nom: "",
  telephone: "",
  courriel: "",
  adresse: "",
  codePostal: "",
  marque: "",
  modele: "",
  annee: "",
  plainte: "",
};

// Borne d'enregistrement client — accessible sans connexion via un QR
// code au comptoir ou une tablette dans l'atelier (voir middleware.ts).
// N'écrit jamais dans les vraies données : tout atterrit dans
// demandes_accueil, en attente de validation par la réception.
export default function PageAccueil() {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<Valeurs>(VALEURS_VIDES);
  const [marqueLibre, setMarqueLibre] = useState(false);
  const [modeleLibre, setModeleLibre] = useState(false);
  const [anneeLibre, setAnneeLibre] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const marques = useMarques();
  const modeles = useModeles(marqueLibre ? "" : valeurs.marque);
  const annees = useAnnees(marqueLibre ? "" : valeurs.marque, modeleLibre ? "" : valeurs.modele);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      nom: valeurs.nom.trim(),
      telephone: valeurs.telephone || null,
      courriel: valeurs.courriel || null,
      adresse: valeurs.adresse || null,
      code_postal: valeurs.codePostal || null,
      marque: valeurs.marque || null,
      modele: valeurs.modele || null,
      annee: valeurs.annee ? Number(valeurs.annee) : null,
      plaque: null,
      plainte: valeurs.plainte || null,
    };
    const reussi = await soumettre(async () => {
      const { error } = await supabase.from("demandes_accueil").insert(donnees);
      return {
        error: error ? { message: "Une erreur est survenue. Adressez-vous directement au comptoir." } : null,
      };
    });
    if (reussi) setEnvoye(true);
  }

  if (envoye) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-mf-bg p-6 overflow-hidden">
        <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.06]">
          <BrandStripes size={640} />
        </div>
        <div className="relative bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-8 w-full max-w-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-mf-success mx-auto mb-3" />
          <h1 className="font-display font-black uppercase tracking-wide text-lg mb-2 text-mf-text">Merci !</h1>
          <p className="text-sm text-mf-text-2">
            Vos renseignements ont été transmis. Un membre de l'équipe vous accueillera dans un instant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-mf-bg p-6 overflow-hidden">
      <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2 opacity-[0.06]">
        <BrandStripes size={640} />
      </div>
      <form
        onSubmit={envoyer}
        className="relative bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-6 sm:p-8 w-full max-w-md flex flex-col gap-3"
      >
        <div className="mb-1">
          <Logo height={22} />
        </div>
        <p className="text-sm text-mf-text-2 mb-2">
          Bienvenue ! Remplissez vos renseignements, un membre de l'équipe vous accueillera dans un instant.
        </p>

        <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Téléphone"
            type="tel"
            value={valeurs.telephone}
            onChange={(e) => definir("telephone", e.target.value)}
          />
          <Champ
            label="Courriel"
            type="email"
            value={valeurs.courriel}
            onChange={(e) => definir("courriel", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Adresse"
            value={valeurs.adresse}
            onChange={(e) => definir("adresse", e.target.value)}
          />
          <Champ
            label="Code postal"
            value={valeurs.codePostal}
            onChange={(e) => definir("codePostal", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {marqueLibre ? (
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

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">
            Raison de votre visite
          </span>
          <textarea
            rows={3}
            value={valeurs.plainte}
            onChange={(e) => definir("plainte", e.target.value)}
            placeholder="Ex. « ça fait un bruit au freinage »"
            className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft resize-none"
          />
        </label>

        {erreur && <MessageErreur>{erreur}</MessageErreur>}

        <p className="text-xs text-mf-text-3">
          Ces renseignements sont transmis à notre équipe pour votre dossier client. Ils ne sont
          utilisés que dans le cadre de votre visite au garage.
        </p>

        <Bouton type="submit" enEnvoi={enEnvoi} className="w-full mt-1">
          Envoyer
        </Bouton>
      </form>
    </div>
  );
}
