// Quantités à la française : « 1,5 h » et non « 1.5 h ».
//
// Les quantités sortaient telles que JavaScript les écrit, avec un point
// décimal, sur les documents que le client garde — évaluation, facture, et
// les courriels qui les lui envoient. Même famille de défaut que les taux
// de taxe affichés « 9.975 % » : rien de faux, mais un document québécois
// qui ressemble à une sortie de programme.
export function formatQuantite(n: number | string): string {
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(n));
}
