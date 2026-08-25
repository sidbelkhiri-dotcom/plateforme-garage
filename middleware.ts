import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname.startsWith("/login");
  // /accueil : borne d'enregistrement client, accessible sans connexion
  // (QR code au comptoir ou tablette dans l'atelier).
  const isPageAccueil = request.nextUrl.pathname.startsWith("/accueil");

  if (!user && !isLoginPage && !isPageAccueil) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Le vrai verrou est est_role() côté base (un compte inactif ne passe
  // plus aucune policy RLS) — ce contrôle n'est qu'un confort d'affichage,
  // pour éviter à un employé congédié de voir un tableau de bord vide et
  // confus plutôt qu'un message clair (audit du 18 août, point 15).
  if (user && !isLoginPage && !isPageAccueil) {
    const { data: profil } = await supabase.from("profiles").select("actif").eq("id", user.id).single();
    if (profil && !profil.actif) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("desactive", "1");
      return NextResponse.redirect(url);
    }
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
