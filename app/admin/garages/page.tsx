import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GaragesClient from "./GaragesClient";

export const dynamic = "force-dynamic";

// Garde côté serveur, même patron que /parametres — sauf qu'ici le
// contrôle n'est pas profiles.role (scopé à un garage) mais
// plateforme_admins, une notion distincte pour tous les garages.
export default async function AdminGaragesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: estAdmin } = await supabase.rpc("est_admin_plateforme");
  if (!estAdmin) redirect("/");

  const { data: garages } = await supabase
    .from("garages")
    .select("*")
    .order("cree_le", { ascending: false });

  return <GaragesClient garagesInitial={garages ?? []} />;
}
