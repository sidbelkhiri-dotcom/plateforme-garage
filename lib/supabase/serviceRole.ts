import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Contourne RLS — réservé au webhook Stripe (aucune session utilisateur
// n'existe pour cet appel serveur-à-serveur) et à rien d'autre. Ne jamais
// importer ce fichier depuis un composant client ou une route qui répond
// à une requête initiée par le navigateur d'un utilisateur.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
