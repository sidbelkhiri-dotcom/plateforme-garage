"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useCategoriesPieces, usePieces } from "@/lib/usePieces";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

const AUTRE = "__autre__";

export type InventaireValeurs = {
  reference: string;
  nom: string;
  quantite: string;
  seuil: string;
  prix_achat: string;
  prix: string;
  fournisseur: string;
};

const VALEURS_VIDES: InventaireValeurs = {
  reference: "",
  nom: "",
  quantite: "0",
  seuil: "3",
  prix_achat: "0",
  prix: "0",
  fournisseur: "",
};

export default function FormulaireInventaire({
  itemId,
  valeursInitiales,
  onSucces,
  onAnnuler,
}: {
  itemId?: string;
  valeursInitiales?: Partial<InventaireValeurs>;
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<InventaireValeurs>({
    ...VALEURS_VIDES,
    ...valeursInitiales,
  });
  // En modification, le nom existant ne vient pas forcément du catalogue —
  // on part en saisie libre pour ne pas perdre une valeur personnalisée.
  const [nomLibre, setNomLibre] = useState(Boolean(itemId));
  const [categorie, setCategorie] = useState("");
  const categories = useCategoriesPieces();
  const pieces = usePieces(categorie);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees: Record<string, unknown> = {
      reference: valeurs.reference || null,
      nom: valeurs.nom.trim(),
      seuil: Number(valeurs.seuil) || 0,
      prix_achat: Number(valeurs.prix_achat) || 0,
      prix: Number(valeurs.prix) || 0,
      fournisseur: valeurs.fournisseur || null,
    };
    // En modification, n'écrire quantite que si l'utilisateur l'a
    // explicitement changée. Ce champ vient d'un instantané chargé à
    // l'ouverture du formulaire ; le stock réel peut avoir bougé entre
    // temps via decrementer_stock_bon() (un bon de travail qui se termine
    // pendant que quelqu'un corrige juste un prix). Toujours écrire en
    // création : il n'y a pas encore de ligne à écraser (audit du 18
    // août, point 9).
    if (!itemId || Number(valeurs.quantite) !== Number(valeursInitiales?.quantite ?? VALEURS_VIDES.quantite)) {
      donnees.quantite = Number(valeurs.quantite) || 0;
    }
    const reussi = await soumettre(async () =>
      itemId
        ? await supabase.from("inventaire").update(donnees).eq("id", itemId)
        : await supabase.from("inventaire").insert(donnees)
    );
    if (reussi) onSucces();
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      {nomLibre ? (
        <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
      ) : (
        <>
          <Selecteur
            label="Catégorie de pièce"
            value={categorie}
            onChange={(e) => {
              setCategorie(e.target.value);
              definir("nom", "");
            }}
          >
            <option value="">— Choisir —</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecteur>
          <Selecteur
            label="Nom de la pièce"
            required
            value={valeurs.nom}
            disabled={!categorie}
            onChange={(e) => {
              if (e.target.value === AUTRE) {
                setNomLibre(true);
                definir("nom", "");
              } else {
                definir("nom", e.target.value);
              }
            }}
          >
            <option value="">{categorie ? "— Choisir —" : "— Choisir une catégorie d'abord —"}</option>
            {pieces.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={AUTRE}>Autre (préciser)…</option>
          </Selecteur>
        </>
      )}
      <Champ label="Référence" value={valeurs.reference} onChange={(e) => definir("reference", e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Quantité" type="number" value={valeurs.quantite} onChange={(e) => definir("quantite", e.target.value)} />
        <Champ label="Seuil (alerte stock bas)" type="number" value={valeurs.seuil} onChange={(e) => definir("seuil", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Champ label="Prix d'achat" type="number" step="0.01" value={valeurs.prix_achat} onChange={(e) => definir("prix_achat", e.target.value)} />
        <Champ label="Prix de vente" type="number" step="0.01" value={valeurs.prix} onChange={(e) => definir("prix", e.target.value)} />
      </div>
      <Champ label="Fournisseur" value={valeurs.fournisseur} onChange={(e) => definir("fournisseur", e.target.value)} />
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-1">
        <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton type="submit" enEnvoi={enEnvoi}>
          {itemId ? "Enregistrer" : "Ajouter la pièce"}
        </Bouton>
      </div>
    </form>
  );
}
