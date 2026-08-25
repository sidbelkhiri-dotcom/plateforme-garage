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
  notes: string;
};

const VALEURS_VIDES: ClientValeurs = {
  nom: "",
  telephone: "",
  email: "",
  adresse: "",
  codePostal: "",
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
      <Champ label="Notes" value={valeurs.notes} onChange={(e) => definir("notes", e.target.value)} />
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-1">
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
