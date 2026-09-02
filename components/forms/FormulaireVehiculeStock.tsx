"use client";

import { useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useMarques, useModeles, useAnnees } from "@/lib/useMarquesModeles";
import { useProfil } from "@/lib/useProfil";
import { BUCKET_VEHICULES_STOCK, urlPhotoVehiculeStock } from "@/lib/vehiculesStockPhotos";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

const AUTRE = "__autre__";

export type VehiculeStockValeurs = {
  marque: string;
  modele: string;
  annee: string;
  vin: string;
  plaque: string;
  couleur: string;
  kilometrage: string;
  cout_achat: string;
  prix_demande: string;
  notes: string;
};

export type VehiculeStockPhotos = string[];

const VALEURS_VIDES: VehiculeStockValeurs = {
  marque: "",
  modele: "",
  annee: "",
  vin: "",
  plaque: "",
  couleur: "",
  kilometrage: "",
  cout_achat: "0",
  prix_demande: "0",
  notes: "",
};

export default function FormulaireVehiculeStock({
  vehiculeId,
  valeursInitiales,
  photosInitiales,
  onSucces,
  onAnnuler,
}: {
  vehiculeId?: string;
  valeursInitiales?: Partial<VehiculeStockValeurs>;
  photosInitiales?: VehiculeStockPhotos;
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { profil } = useProfil();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<VehiculeStockValeurs>({
    ...VALEURS_VIDES,
    ...valeursInitiales,
  });

  // En modification, on garde la saisie libre par défaut — même raison
  // que FormulaireVehicule.tsx : forcer une valeur existante dans le menu
  // déroulant risquerait de perdre une valeur absente de la base moissonnée.
  const [marqueLibre, setMarqueLibre] = useState(!!valeursInitiales?.marque);
  const [modeleLibre, setModeleLibre] = useState(!!valeursInitiales?.marque);
  const [anneeLibre, setAnneeLibre] = useState(!!valeursInitiales?.marque);
  const marques = useMarques();
  const modeles = useModeles(marqueLibre ? "" : valeurs.marque);
  const annees = useAnnees(marqueLibre ? "" : valeurs.marque, modeleLibre ? "" : valeurs.modele);

  const [photos, setPhotos] = useState<string[]>(photosInitiales ?? []);
  const [enTeleversement, setEnTeleversement] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);

  async function ajouterPhotos(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    setEnTeleversement(true);
    setErreurPhoto(null);
    const nouveauxChemins: string[] = [];
    for (const fichier of Array.from(fichiers)) {
      // Préfixe garage_id : la RLS sur storage.objects vérifie ce premier
      // segment du chemin (storage.foldername(name)[1]) — sans lui, tous
      // les garages partageraient le même espace de noms plat.
      const chemin = `${profil?.garage_id}/${crypto.randomUUID()}-${fichier.name}`;
      const { error } = await supabase.storage.from(BUCKET_VEHICULES_STOCK).upload(chemin, fichier);
      if (error) {
        setErreurPhoto(error.message);
        continue;
      }
      nouveauxChemins.push(chemin);
    }
    setPhotos((p) => [...p, ...nouveauxChemins]);
    setEnTeleversement(false);
  }

  async function supprimerPhoto(chemin: string) {
    setPhotos((p) => p.filter((c) => c !== chemin));
    await supabase.storage.from(BUCKET_VEHICULES_STOCK).remove([chemin]);
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      marque: valeurs.marque.trim(),
      modele: valeurs.modele.trim(),
      annee: valeurs.annee ? Number(valeurs.annee) : null,
      vin: valeurs.vin || null,
      plaque: valeurs.plaque || null,
      couleur: valeurs.couleur || null,
      kilometrage: valeurs.kilometrage ? Number(valeurs.kilometrage) : null,
      cout_achat: Number(valeurs.cout_achat) || 0,
      prix_demande: Number(valeurs.prix_demande) || 0,
      notes: valeurs.notes || null,
      photos,
    };
    const reussi = await soumettre(async () =>
      vehiculeId
        ? await supabase.from("vehicules_stock").update(donnees).eq("id", vehiculeId)
        : await supabase.from("vehicules_stock").insert(donnees)
    );
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
          <Champ label="Modèle" required value={valeurs.modele} onChange={(e) => definir("modele", e.target.value)} />
        ) : (
          <Selecteur
            label="Modèle"
            required
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
          <Champ label="Année" type="number" value={valeurs.annee} onChange={(e) => definir("annee", e.target.value)} />
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

      <Champ label="Kilométrage" type="number" value={valeurs.kilometrage} onChange={(e) => definir("kilometrage", e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <Champ
          label="Coût d'achat"
          type="number"
          step="0.01"
          value={valeurs.cout_achat}
          onChange={(e) => definir("cout_achat", e.target.value)}
        />
        <Champ
          label="Prix demandé"
          type="number"
          step="0.01"
          value={valeurs.prix_demande}
          onChange={(e) => definir("prix_demande", e.target.value)}
        />
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">Notes</span>
        <textarea
          rows={2}
          value={valeurs.notes}
          onChange={(e) => definir("notes", e.target.value)}
          className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-[3px] focus:ring-mf-blue-soft resize-none"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">Photos</span>
        <div className="flex flex-wrap gap-2">
          {photos.map((chemin) => (
            <div key={chemin} className="relative w-20 h-16 shrink-0">
              <img
                src={urlPhotoVehiculeStock(supabase, chemin)}
                alt=""
                className="w-full h-full object-cover rounded-mf-sm border border-mf-border"
              />
              <button
                type="button"
                onClick={() => supprimerPhoto(chemin)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-mf-red text-white"
                aria-label="Retirer cette photo"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <label className="w-20 h-16 shrink-0 flex flex-col items-center justify-center gap-1 border border-dashed border-mf-border-strong rounded-mf-sm text-mf-text-3 hover:text-mf-text hover:border-mf-blue cursor-pointer text-[10px] text-center">
            <ImagePlus className="w-4 h-4" />
            {enTeleversement ? "…" : "Ajouter"}
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={enTeleversement}
              onChange={(e) => ajouterPhotos(e.target.files)}
              className="hidden"
            />
          </label>
        </div>
        {erreurPhoto && <MessageErreur>{erreurPhoto}</MessageErreur>}
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
