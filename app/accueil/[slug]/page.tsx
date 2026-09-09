"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ScanSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMarques, useModeles, useAnnees } from "@/lib/useMarquesModeles";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";
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
  vin: string;
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
  vin: "",
  plainte: "",
};

type GaragePublic = { id: string; nom: string };

// Borne d'enregistrement client — accessible sans connexion via un QR
// code au comptoir ou une tablette dans l'atelier (voir middleware.ts).
// Le slug dans l'URL identifie le garage — résolu via la fonction
// security definer obtenir_garage_public() (jamais une lecture directe
// de `garages`, qui contient des colonnes sensibles comme
// stripe_customer_id). N'écrit jamais dans les vraies données : tout
// atterrit dans demandes_accueil, en attente de validation par la
// réception de CE garage précis (garage_id posé à l'envoi).
export default function PageAccueil({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<Valeurs>(VALEURS_VIDES);
  const [marqueLibre, setMarqueLibre] = useState(false);
  const [modeleLibre, setModeleLibre] = useState(false);
  const [anneeLibre, setAnneeLibre] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [garage, setGarage] = useState<GaragePublic | null | undefined>(undefined);
  const [decodage, setDecodage] = useState<{ enCours: boolean; erreur: string | null }>({
    enCours: false,
    erreur: null,
  });
  const marques = useMarques();
  const modeles = useModeles(marqueLibre ? "" : valeurs.marque);
  const annees = useAnnees(marqueLibre ? "" : valeurs.marque, modeleLibre ? "" : valeurs.modele);

  // Passe en saisie libre pour marque/modèle/année : le NIV peut décoder
  // une valeur absente du catalogue de référence (voir FormulaireVehicule).
  async function decoderVin() {
    setDecodage({ enCours: true, erreur: null });
    try {
      const reponse = await fetch("/api/decoder-vin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: valeurs.vin }),
      });
      const resultat = await reponse.json();
      if (!reponse.ok) {
        setDecodage({ enCours: false, erreur: resultat.error ?? "Décodage impossible." });
        return;
      }
      setMarqueLibre(true);
      setModeleLibre(true);
      setAnneeLibre(true);
      definir("marque", resultat.marque ?? "");
      definir("modele", resultat.modele ?? "");
      definir("annee", resultat.annee ?? "");
      setDecodage({ enCours: false, erreur: null });
    } catch {
      setDecodage({ enCours: false, erreur: "Le service de décodage ne répond pas. Réessayez." });
    }
  }

  useEffect(() => {
    supabase
      .rpc("obtenir_garage_public", { p_slug: params.slug })
      .then(({ data }) => setGarage(data ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!garage) return;
    const donnees = {
      garage_id: garage.id,
      nom: valeurs.nom.trim(),
      telephone: valeurs.telephone || null,
      courriel: valeurs.courriel || null,
      adresse: valeurs.adresse || null,
      code_postal: valeurs.codePostal || null,
      marque: valeurs.marque || null,
      modele: valeurs.modele || null,
      annee: valeurs.annee ? Number(valeurs.annee) : null,
      plaque: null,
      vin: valeurs.vin.trim() || null,
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

  // undefined = chargement en cours, null = slug inconnu ou garage inactif.
  if (garage === undefined) {
    return <div className="min-h-screen bg-mf-bg" />;
  }

  if (garage === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mf-bg p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-mf-red mx-auto mb-3" />
          <p className="text-sm text-mf-text">Ce lien n'est plus valide. Adressez-vous directement au comptoir.</p>
        </div>
      </div>
    );
  }

  if (envoye) {
    return (
      <div className="relative min-h-screen flex items-center justify-center bg-mf-bg p-6 overflow-hidden">
        <div className="relative bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-8 w-full max-w-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-mf-success mx-auto mb-3" />
          <h1 className="font-display font-bold uppercase tracking-wide text-lg mb-2 text-mf-text">Merci !</h1>
          <p className="text-sm text-mf-text-2">
            Vos renseignements ont été transmis. Un membre de l'équipe vous accueillera dans un instant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-mf-bg p-6 overflow-hidden">
      <form
        onSubmit={envoyer}
        className="relative bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-6 sm:p-8 w-full max-w-md flex flex-col gap-3"
      >
        <div className="mb-1">
          <Logo height={22} />
        </div>
        <p className="text-sm text-mf-text-2 mb-2">
          Bienvenue chez {garage.nom} ! Remplissez vos renseignements, un membre de l'équipe vous accueillera dans un
          instant.
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

        <div>
          <Champ
            label="NIV (VIN) — facultatif"
            value={valeurs.vin}
            onChange={(e) => definir("vin", e.target.value.toUpperCase())}
            placeholder="17 caractères, inscrit sur votre carte d'immatriculation"
            maxLength={17}
          />
          <button
            type="button"
            onClick={decoderVin}
            disabled={valeurs.vin.trim().length !== 17 || decodage.enCours}
            className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-mf-blue-hover hover:text-mf-blue disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            {decodage.enCours ? "Décodage en cours…" : "Remplir marque/modèle/année automatiquement"}
          </button>
          {decodage.erreur && <p className="text-xs text-mf-red mt-1">{decodage.erreur}</p>}
        </div>

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
