import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ParametresClient from "./ParametresClient";

export const dynamic = "force-dynamic";

// Garde côté serveur (8.4) — pas un simple bouton caché : une visite
// directe à /parametres par un compte non-admin est redirigée avant même
// que la page ne s'affiche.
export default async function ParametresPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profil?.role !== "admin") redirect("/");

  const [{ data: parametres }, { data: profils }] = await Promise.all([
    supabase.from("parametres").select("*").single(),
    supabase.from("profiles").select("*").order("nom"),
  ]);

  return <ParametresClient parametresInitial={parametres} profilsInitial={profils ?? []} monId={user.id} />;
}
