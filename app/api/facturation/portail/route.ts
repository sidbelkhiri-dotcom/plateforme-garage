import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Ouvre le portail client Stripe (annulation, changement de carte,
// historique de factures) — hébergé par Stripe, rien de ça ne transite
// par notre serveur.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erreur: "Non connecté." }, { status: 401 });

  const { data: profil } = await supabase.from("profiles").select("role, garage_id").eq("id", user.id).single();
  if (profil?.role !== "admin" || !profil.garage_id) {
    return NextResponse.json({ erreur: "Seul l'administrateur du garage peut gérer la facturation." }, { status: 403 });
  }

  const { data: garage } = await supabase
    .from("garages")
    .select("stripe_customer_id")
    .eq("id", profil.garage_id)
    .single();
  if (!garage?.stripe_customer_id) {
    return NextResponse.json({ erreur: "Aucun abonnement actif pour ce garage." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: garage.stripe_customer_id,
      return_url: `${origin}/facturation`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ erreur: (err as Error).message }, { status: 500 });
  }
}
