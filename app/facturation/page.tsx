import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FacturationClient from "./FacturationClient";

export const dynamic = "force-dynamic";

// Garde côté serveur, même patron que /parametres — réservé à l'admin du
// garage.
export default async function FacturationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profil } = await supabase.from("profiles").select("role, garage_id").eq("id", user.id).single();
  if (profil?.role !== "admin") redirect("/");

  const { data: garage } = await supabase
    .from("garages")
    .select("nom, abonnement_statut, stripe_customer_id")
    .eq("id", profil.garage_id)
    .single();

  return <FacturationClient garageInitial={garage ?? null} />;
}
