import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InspectionClient from "./InspectionClient";

export const dynamic = "force-dynamic";

// Même garde que le reste de la fiche bon de travail — pas de rôle
// restreint : un mécanicien fait l'inspection, pas seulement admin/réception.
export default async function InspectionPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bon } = await supabase
    .from("bons_travail")
    .select("id, numero, plainte_client, client_id, vehicule_id")
    .eq("id", params.id)
    .single();
  if (!bon) redirect("/bons-travail");

  const [{ data: client }, { data: vehicule }, { data: inspection }] = await Promise.all([
    bon.client_id ? supabase.from("clients").select("nom, email").eq("id", bon.client_id).single() : Promise.resolve({ data: null }),
    bon.vehicule_id
      ? supabase.from("vehicules").select("marque, modele, annee").eq("id", bon.vehicule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("inspections").select("*").eq("bon_travail_id", params.id).order("cree_le", { ascending: false }).limit(1).maybeSingle(),
  ]);

  let points: any[] = [];
  if (inspection) {
    const { data } = await supabase
      .from("inspection_points")
      .select("*, inspection_photos(id, identifiant_public, chemin)")
      .eq("inspection_id", inspection.id)
      .order("ordre");
    points = data ?? [];
  }

  return (
    <InspectionClient
      bon={bon}
      client={client}
      vehicule={vehicule}
      inspectionInitiale={inspection}
      pointsInitiaux={points}
    />
  );
}
