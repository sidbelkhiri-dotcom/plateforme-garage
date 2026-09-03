"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Selecteur from "@/components/ui/Selecteur";

type Garage = { id: string; nom: string };

// Visible seulement pour un super-admin plateforme (une ligne dans
// plateforme_admins) — permet de se "placer" dans un garage précis pour
// consulter/gérer ses données, garage_actuel() bascule dessus (voir
// migration 2026-09-16). Un compte normal ne voit rien : la requête sur
// plateforme_admins ne renvoie simplement aucune ligne pour lui.
export default function SelecteurGarageAdmin() {
  const supabase = createClient();
  const [garages, setGarages] = useState<Garage[] | null>(null);
  const [selection, setSelection] = useState<string>("");

  useEffect(() => {
    let actif = true;
    async function charger() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: admin } = await supabase
        .from("plateforme_admins")
        .select("garage_selectionne")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!actif) return;
      if (!admin) {
        setGarages(null);
        return;
      }
      setSelection(admin.garage_selectionne ?? "");
      const { data: g } = await supabase.from("garages").select("id, nom").order("nom");
      if (!actif) return;
      setGarages(g ?? []);
    }
    charger();
    return () => {
      actif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changer(garageId: string) {
    setSelection(garageId);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("plateforme_admins")
      .update({ garage_selectionne: garageId || null })
      .eq("user_id", user.id);
    // garage_actuel() est relue à chaque requête RLS — un rechargement
    // complet est le moyen le plus sûr de refléter le changement partout,
    // plutôt que de traquer chaque composant ayant déjà chargé des données
    // de l'ancien garage.
    window.location.reload();
  }

  if (garages === null) return null;

  return (
    <div className="px-5 py-3 border-b border-mf-border">
      <Selecteur label="Garage consulté" value={selection} onChange={(e) => changer(e.target.value)}>
        <option value="">Mon garage</option>
        {garages.map((g) => (
          <option key={g.id} value={g.id}>
            {g.nom}
          </option>
        ))}
      </Selecteur>
    </div>
  );
}
