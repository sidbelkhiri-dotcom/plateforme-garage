import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";

// Appelé par les serveurs de Stripe, sans session Supabase — la signature
// est la seule preuve d'authenticité (voir middleware.ts pour l'exemption
// d'authentification de cette route). garage_id vient toujours de
// subscription.metadata, posé par nous à la création (creer-session/route.ts),
// jamais d'une valeur fournie par l'appelant.
export async function POST(request: Request) {
  const corps = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ erreur: "Signature manquante." }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(corps, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ erreur: `Signature invalide : ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const garageId = session.client_reference_id;
      if (garageId && session.customer && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await supabase
          .from("garages")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            abonnement_statut: subscription.status,
          })
          .eq("id", garageId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const garageId = subscription.metadata?.garage_id;
      if (garageId) {
        await supabase
          .from("garages")
          .update({ abonnement_statut: subscription.status })
          .eq("id", garageId);
      }
      break;
    }
  }

  return NextResponse.json({ recu: true });
}
