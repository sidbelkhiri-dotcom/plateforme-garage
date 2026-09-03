import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// Ouvre une session Stripe Checkout pour le garage de l'admin connecté.
// client_reference_id = garage_id est la seule chose qui relie ensuite le
// paiement au bon garage — c'est nous qui le fixons ici, jamais une valeur
// reçue du client, donc infalsifiable côté navigateur.
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

  const origin = new URL(request.url).origin;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      client_reference_id: profil.garage_id,
      customer_email: user.email,
      subscription_data: { trial_period_days: 14, metadata: { garage_id: profil.garage_id } },
      success_url: `${origin}/facturation?succes=1`,
      cancel_url: `${origin}/facturation`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    return NextResponse.json({ erreur: (err as Error).message }, { status: 500 });
  }
}
