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

  const { data: profil } = await supabase.from("profiles").select("role, garage_id").eq("id", user.id).single();
  if (profil?.role !== "admin") redirect("/");

  const [{ data: parametres }, { data: profils }, { data: garage }] = await Promise.all([
    supabase.from("parametres").select("*").single(),
    supabase.from("profiles").select("*").order("nom"),
    // Le slug des pages publiques. Il n'était lu nulle part dans
    // l'application du personnel : un garage n'avait aucun moyen de
    // connaître l'adresse de sa propre page d'arrivée au comptoir.
    profil.garage_id
      ? supabase.from("garages").select("slug").eq("id", profil.garage_id).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <ParametresClient
      parametresInitial={parametres}
      profilsInitial={profils ?? []}
      monId={user.id}
      slug={garage?.slug ?? null}
    />
  );
}
