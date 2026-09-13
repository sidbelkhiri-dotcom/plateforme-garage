import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Point d'arrivée de tous les liens envoyés par courriel : confirmation
// d'inscription et réinitialisation du mot de passe.
//
// Avant cette route, aucun écran ne recevait ces liens. Supabase renvoyait
// vers son « Site URL » (http://localhost:3000 sur le projet de dev) : un
// garage qui s'inscrivait sur le site en ligne cliquait sur un lien mort.
//
// Deux formes de lien arrivent ici :
//   - ?token_hash=…&type=… : le gabarit de courriel pointe directement vers
//     l'application. Fonctionne quel que soit l'appareil qui ouvre le
//     courriel — c'est la forme à configurer dans Supabase ;
//   - ?code=… : le lien par défaut (PKCE). Ne s'échange que dans le
//     navigateur qui a fait la demande ; ailleurs, le compte est tout de
//     même confirmé par Supabase, il reste à se connecter.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const suite = cheminInterne(searchParams.get("suite")) ?? (type === "recovery" ? "/nouveau-mot-de-passe" : "/");

  const supabase = createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}${suite}`);
    return NextResponse.redirect(`${origin}/login?lien=expire`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${suite}`);
    // Autre navigateur que celui de la demande : pour une inscription, le
    // compte est confirmé ; pour un mot de passe, il faut recommencer ici.
    return NextResponse.redirect(
      `${origin}${suite === "/nouveau-mot-de-passe" ? "/mot-de-passe-oublie?lien=autre-appareil" : "/login?confirme=1"}`
    );
  }

  return NextResponse.redirect(`${origin}/login`);
}

// Seul un chemin de l'application est accepté : sans ce filtre, un lien
// forgé (?suite=//site-malveillant.com) ferait de Garagenda un redirecteur.
function cheminInterne(valeur: string | null): string | null {
  if (!valeur || !valeur.startsWith("/") || valeur.startsWith("//") || valeur.includes("\\")) return null;
  return valeur;
}
