"use client";

import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { todayLocal } from "@/lib/dates";
import Champ from "@/components/ui/Champ";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

type VenteValeurs = {
  prix_vente: string;
  acheteur_nom: string;
  acheteur_telephone: string;
  vendu_le: string;
};

// Vente simple, pas de facture générée (contrairement aux réparations) —
// juste ce qu'il faut pour calculer la marge et retrouver l'acheteur.
export default function FormulaireVenteVehiculeStock({
  vehiculeId,
  prixDemande,
  onSucces,
  onAnnuler,
}: {
  vehiculeId: string;
  prixDemande: number;
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<VenteValeurs>({
    prix_vente: String(prixDemande),
    acheteur_nom: "",
    acheteur_telephone: "",
    vendu_le: todayLocal(),
  });

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      statut: "vendu",
      prix_vente: Number(valeurs.prix_vente) || 0,
      acheteur_nom: valeurs.acheteur_nom.trim(),
      acheteur_telephone: valeurs.acheteur_telephone || null,
      vendu_le: valeurs.vendu_le,
    };
    const reussi = await soumettre(async () => await supabase.from("vehicules_stock").update(donnees).eq("id", vehiculeId));
    if (reussi) onSucces();
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      <Champ
        label="Nom de l'acheteur"
        required
        value={valeurs.acheteur_nom}
        onChange={(e) => definir("acheteur_nom", e.target.value)}
      />
      <div className="grid grid-cols-2 gap-3">
        <Champ
          label="Téléphone"
          type="tel"
          value={valeurs.acheteur_telephone}
          onChange={(e) => definir("acheteur_telephone", e.target.value)}
        />
        <Champ
          label="Date de vente"
          type="date"
          required
          value={valeurs.vendu_le}
          onChange={(e) => definir("vendu_le", e.target.value)}
        />
      </div>
      <Champ
        label="Prix de vente réel"
        type="number"
        step="0.01"
        required
        value={valeurs.prix_vente}
        onChange={(e) => definir("prix_vente", e.target.value)}
      />
      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-1">
        <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton type="submit" enEnvoi={enEnvoi}>
          Confirmer la vente
        </Bouton>
      </div>
    </form>
  );
}
