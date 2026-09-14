import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { garageOperationnel } from "@/lib/abonnement";

// En-tête interne qui dit à la mise en page racine d'afficher la vitrine
// sans la coquille de l'application (barre latérale). Posé ici seulement :
// retiré de toute requête entrante pour qu'un visiteur ne puisse pas
// l'imposer lui-même — sans conséquence de sécurité, mais sans raison d'être.
const ENTETE_VITRINE = "x-garagenda-vitrine";

export async function middleware(request: NextRequest) {
  const entetes = new Headers(request.headers);
  entetes.delete(ENTETE_VITRINE);
  let response = NextResponse.next({ request: { headers: entetes } });

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

  // Site vitrine. Un visiteur non connecté qui arrive à la racine voit la
  // présentation de Garagenda plutôt qu'un écran de connexion ; un garage
  // connecté arrive toujours sur son tableau de bord. /decouvrir reste
  // accessible à tous, connecté ou non, pour pouvoir la montrer.
  const chemin = request.nextUrl.pathname;
  if (chemin === "/decouvrir" || (!user && chemin === "/")) {
    const entetesVitrine = new Headers(entetes);
    entetesVitrine.set(ENTETE_VITRINE, "1");
    let reponseVitrine: NextResponse;
    if (chemin === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/decouvrir";
      reponseVitrine = NextResponse.rewrite(url, { request: { headers: entetesVitrine } });
    } else {
      reponseVitrine = NextResponse.next({ request: { headers: entetesVitrine } });
    }
    // Garde les témoins de session rafraîchis par Supabase plus haut.
    response.cookies.getAll().forEach((c) => reponseVitrine.cookies.set(c));
    return reponseVitrine;
  }

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
  // Liens reçus par courriel (confirmation, réinitialisation) et demande de
  // nouveau mot de passe : par définition, la personne n'est pas connectée.
  const isPageAuthPublique =
    request.nextUrl.pathname.startsWith("/auth/confirmation") ||
    request.nextUrl.pathname.startsWith("/mot-de-passe-oublie") ||
    // Politique de confidentialité : doit se lire avant de créer un compte.
    request.nextUrl.pathname === "/confidentialite";

  if (!user && !isLoginPage && !isPageAccueil && !isPageInscription && !isWebhookStripe && !isPageInspectionPublique && !isCron && !isPageAuthPublique) {
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
    // DÉCISION DE PHASE PILOTE (2026-09-12) — un garage sans abonnement
    // (abonnement_statut null, soit tout garage qui vient de s'inscrire)
    // garde un accès complet, sans limite de durée. Ce n'est pas un oubli :
    // aucun garage payant n'existe encore, et on laisse l'accès libre le
    // temps de la phase pilote. Avant le premier garage payant, trancher
    // entre un essai à durée limitée et le paiement avant usage.
    //
    // La règle elle-même vit dans lib/abonnement.ts, partagée avec les
    // tâches planifiées, et a une jumelle côté base (garage_operationnel()).
    // scripts/isolation.mjs éprouve la version SQL état par état : il
    // échouera si la décision change, pour forcer à réviser cette note
    // plutôt qu'à la laisser mentir.
    //
    // Le `!!garage &&` préserve le comportement d'origine : un compte sans
    // garage (admin de plateforme, inscription en cours) n'est pas considéré
    // comme bloqué ici.
    const garageBloque = !!garage && !garageOperationnel(garage);

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
  // apple-icon et manifest.webmanifest n'ont pas d'extension reconnue par
  // la liste ci-dessous : sans exclusion explicite ils étaient redirigés
  // vers /login, donc le manifeste PWA et l'icône iOS ne se chargeaient
  // jamais pour un visiteur non connecté.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
