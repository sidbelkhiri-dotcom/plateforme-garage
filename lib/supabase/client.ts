import { createBrowserClient } from "@supabase/ssr";

// Instance unique, partagée par tout le navigateur — 34 fichiers appellent
// createClient() indépendamment, et chacun créait jusqu'ici sa propre
// copie du client (multiples GoTrueClient distincts dans le même onglet).
// Chaque copie garde son propre état de connexion en mémoire ; un
// signOut() sur l'une (LogoutButton) ne prévenait jamais les autres
// (useProfil dans la barre latérale), qui gardait donc le rôle de
// l'ancien compte affiché après une reconnexion avec un autre utilisateur
// dans le même onglet. Un seul client, une seule source de vérité pour
// onAuthStateChange.
let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
