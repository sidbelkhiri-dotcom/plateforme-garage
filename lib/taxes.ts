// Taxes : le même calcul que la base, au cent près.
//
// creer_facture() calcule chaque taxe avec round(total_ht * taux, 2), en
// décimal exact, arrondi au plus proche avec les cas « au milieu » vers le
// haut. Refaire ce calcul en nombres à virgule flottante JavaScript tombe
// juste presque toujours — et faux d'un cent dans certains cas limites
// (1.005 * 100 vaut 100.49999999999999). Or l'évaluation affiche désormais
// un total estimé avec taxes, que le client comparera à sa facture : un
// cent d'écart suffit à laisser croire qu'on a dépassé le prix accepté.
// Le calcul se fait donc en cents entiers, sans aucune division flottante.
// Le total avant taxes a toujours deux décimales en base (numeric(10,2)) :
// sa conversion en cents par Math.round est exacte. Le piège est ailleurs,
// dans la taxe elle-même : 20,70 × 5 % vaut 1,035, que la base arrondit à
// 1,04 et le calcul naïf à 1,03. Mesuré le 2026-09-13 sur tous les montants
// de 0,01 à 5 000,00 $ : 408 cas faux d'un cent pour la TPS, aucun pour la
// TVQ à son taux actuel — ce qui ne garantit rien si le taux change.

const ECHELLE_TAUX = 100000; // les taux ont au plus cinq décimales (0,09975)

export function montantTaxe(totalHt: number, taux: number): number {
  const centsHt = Math.round(totalHt * 100);
  const tauxEntier = Math.round(taux * ECHELLE_TAUX);
  const produit = centsHt * tauxEntier;
  const reste = produit % ECHELLE_TAUX;
  let cents = (produit - reste) / ECHELLE_TAUX;
  if (2 * reste >= ECHELLE_TAUX) cents += 1;
  return cents / 100;
}

// « 9,975 % » et non « 9.975 % » : virgule décimale, sans zéros inutiles, et
// l'espace insécable que le français met devant le signe pour cent.
export function formatTaux(taux: number): string {
  const pourcentage = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 3 }).format(taux * 100);
  return `${pourcentage} %`;
}
