"use client";

import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import Champ from "@/components/ui/Champ";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

export type ClientValeurs = {
  nom: string;
  telephone: string;
  email: string;
  adresse: string;
  codePostal: string;
  tauxHoraire: string;
  notes: string;
};

const VALEURS_VIDES: ClientValeurs = {
  nom: "",
  telephone: "",
  email: "",
  adresse: "",
  codePostal: "",
  tauxHoraire: "",
  notes: "",
};

// Sert à la fois pour créer (clientId absent) et modifier (clientId fourni).
export default function FormulaireClient({
  clientId,
  valeursInitiales,
  onSucces,
  onAnnuler,
}: {
  clientId?: string;
  valeursInitiales?: Partial<ClientValeurs>;
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<ClientValeurs>({
    ...VALEURS_VIDES,
    ...valeursInitiales,
  });

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      nom: valeurs.nom.trim(),
      telephone: valeurs.telephone || null,
      email: valeurs.email || null,
      adresse: valeurs.adresse || null,
      code_postal: valeurs.codePostal || null,
      // Champ vide = null = le client suit le taux du garage. On ne
      // convertit surtout pas en 0, qui signifierait « main-d'œuvre
      // gratuite » et ne se verrait qu'à la facture.
      taux_horaire: valeurs.tauxHoraire.trim() === "" ? null : Number(valeurs.tauxHoraire),
      notes: valeurs.notes || null,
    };
    const reussi = await soumettre(async () =>
      clientId
        ? await supabase.from("clients").update(donnees).eq("id", clientId)
        : await supabase.from("clients").insert(donnees)
    );
    if (reussi) onSucces();
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
      <Champ
        label="Téléphone"
        value={valeurs.telephone}
        onChange={(e) => definir("telephone", e.target.value)}
      />
      <Champ
        label="Courriel"
        type="email"
        value={valeurs.email}
        onChange={(e) => definir("email", e.target.value)}
      />
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
      <Champ
        label="Taux horaire négocié ($/h)"
        type="number"
        min="0"
        step="0.01"
        placeholder="Taux du garage"
        value={valeurs.tauxHoraire}
        onChange={(e) => definir("tauxHoraire", e.target.value)}
      />
      <Champ label="Notes" value={valeurs.notes} onChange={(e) => definir("notes", e.target.value)} />
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div /* Pied collant. Ces formulaires vivent tous dans une modale, dont c'est
             le conteneur de dialogue qui défile : sans ça, sur un formulaire de
             huit champs, il fallait remplir puis chercher le bouton. Les marges
             négatives le font affleurer les bords du dialogue, dont il reprend
             le fond — un pied collant translucide laisserait les champs défiler
             visiblement dessous. */
          className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-3 px-5 py-3 bg-mf-surface-2 border-t border-mf-border flex justify-end gap-2">
        <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton type="submit" enEnvoi={enEnvoi}>
          {clientId ? "Enregistrer" : "Créer le client"}
        </Bouton>
      </div>
    </form>
  );
}
