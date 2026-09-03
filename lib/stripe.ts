import Stripe from "stripe";

let instance: Stripe | null = null;

// Construite à la demande, pas au chargement du module : sinon Next essaie
// d'instancier le client (donc de lire la clé secrète) au moment de
// l'analyse statique des routes pendant le build, qui échoue tant que
// STRIPE_SECRET_KEY n'est pas encore posée dans l'environnement.
export function getStripe() {
  if (!instance) {
    instance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return instance;
}
