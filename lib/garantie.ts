// Garantie légale (PRD §4.3) : 3 mois OU 5 000 km, selon la première
// échéance — donc couverte seulement tant que LES DEUX conditions tiennent
// encore. Paramétrable via garantie_mois / garantie_km (table parametres).

function finGarantieDate(fermeLe: string, garantieMois: number): string {
  const [y, m, d] = fermeLe.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + garantieMois, d, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function estSousGarantie({
  fermeLe,
  kilometrageBon,
  garantieMois,
  garantieKm,
  kilometrageActuel,
  aujourdHui,
}: {
  fermeLe: string | null;
  kilometrageBon: number;
  garantieMois: number;
  garantieKm: number;
  kilometrageActuel: number;
  aujourdHui: string;
}): { couverte: boolean; dateLimite: string; kmLimite: number } | null {
  if (!fermeLe) return null; // bon pas encore terminé : rien à garantir
  const dateLimite = finGarantieDate(fermeLe, garantieMois);
  const kmLimite = kilometrageBon + garantieKm;
  const couverte = aujourdHui <= dateLimite && kilometrageActuel <= kmLimite;
  return { couverte, dateLimite, kmLimite };
}
