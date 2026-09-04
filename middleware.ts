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
  // /inscription : création de compte + garage self-service, accessible
  // sans connexion (c'est tout son but).
  const isPageInscription = request.nextUrl.pathname.startsWith("/inscription");
  // Webhook Stripe : appelé par les serveurs de Stripe, jamais par un
  // navigateur avec une session — la signature Stripe est le seul verrou
  // (voir app/api/webhooks/stripe/route.ts).
  const isWebhookStripe = request.nextUrl.pathname.startsWith("/api/webhooks/stripe");
  // /inspection/[jeton] : page publique client, sans compte — le jeton
  // dans l'URL est le seul verrou (fonctions security definer, voir
  // migration 2026-08-25_inspection_numerique.sql).
  const isPageInspectionPublique = request.nextUrl.pathname.startsWith("/inspection/");
  // Tâche programmée (Vercel Cron) : aucune session utilisateur possible,
  // CRON_SECRET est le seul verrou (voir app/api/cron/.../route.ts).
  const isCron = request.nextUrl.pathname.startsWith("/api/cron/");

  if (!user && !isLoginPage && !isPageAccueil && !isPageInscription && !isWebhookStripe && !isPageInspectionPublique && !isCron) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Le vrai verrou est est_role() côté base (un compte inactif ne passe
  // plus aucune policy RLS) — ce contrôle n'est qu'un confort d'affichage,
  // pour éviter à un employé congédié de voir un tableau de bord vide et
  // confus plutôt qu'un message clair (audit du 18 août, point 15).
  const isPageFacturation = request.nextUrl.pathname.startsWith("/facturation");
  if (user && !isLoginPage && !isPageAccueil && !isPageInscription && !isPageInspectionPublique) {
    const { data: profil } = await supabase
      .from("profiles")
      .select("actif, garages(statut, abonnement_statut)")
      .eq("id", user.id)
      .single();
    if (profil && !profil.actif) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("desactive", "1");
      return NextResponse.redirect(url);
    }

    // Même logique de confort d'affichage : le garage lui-même peut être
    // bloqué (suspendu par le super-admin, ou abonnement Stripe en échec).
    // /facturation reste toujours accessible pour permettre de régler le
    // problème (ou de contacter l'admin du garage, voir FacturationClient).
    const garage = profil?.garages as unknown as { statut: string; abonnement_statut: string | null } | null;
    const STATUTS_ABONNEMENT_BLOQUANTS = ["past_due", "canceled", "unpaid", "incomplete_expired"];
    const garageBloque =
      garage &&
      (garage.statut !== "actif" ||
        (garage.abonnement_statut !== null && STATUTS_ABONNEMENT_BLOQUANTS.includes(garage.abonnement_statut)));

    if (garageBloque && !isPageFacturation) {
      const { data: estAdmin } = await supabase.rpc("est_admin_plateforme");
      if (!estAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/facturation";
        url.searchParams.set("bloque", "1");
        return NextResponse.redirect(url);
      }
    }
  }

  if (user && (isLoginPage || isPageInscription)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)"],
};
