import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Contourne RLS — deux usages et pas un de plus :
//   - le webhook Stripe (aucune session utilisateur n'existe pour cet
//     appel serveur-à-serveur) ;
//   - /api/inviter-employe, pour la seule API d'administration des comptes
//     (créer l'invité, obtenir le jeton du lien), et seulement APRÈS que
//     preparer_invitation() a validé la demande avec la session de l'admin.
//     Aucune lecture ni écriture de table n'y passe par cette clé.
// Ne jamais importer ce fichier depuis un composant client.
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
