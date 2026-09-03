import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FacturationClient from "./FacturationClient";

export const dynamic = "force-dynamic";

// Contrairement à /parametres, cette page reste accessible à tous les
// rôles du garage (pas seulement admin) : si le garage est bloqué (voir
// middleware.ts), n'importe quel employé peut y être redirigé et doit
// pouvoir comprendre pourquoi — seules les actions (s'abonner, gérer)
// restent réservées à l'admin, filtrées côté client.
export default async function FacturationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profil } = await supabase.from("profiles").select("role, garage_id").eq("id", user.id).single();
  if (!profil?.garage_id) redirect("/");

  const { data: garage } = await supabase
    .from("garages")
    .select("nom, statut, abonnement_statut, stripe_customer_id")
    .eq("id", profil.garage_id)
    .single();

  return <FacturationClient garageInitial={garage ?? null} estAdmin={profil.role === "admin"} />;
}
