// Toute date métier (rendez-vous, bons de travail) raisonne en heure locale
// de l'atelier — jamais en UTC brut. `new Date().toISOString()` bascule au
// jour suivant dès 20 h l'été à Montréal (D18) : c'est le bug corrigé ici.

const TIME_ZONE = "America/Toronto";

/** Date du jour à l'atelier, au format 'YYYY-MM-DD' (compatible colonne `date`). */
export function todayLocal(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Heure actuelle à l'atelier, au format 'HH:mm' (compatible colonne `time`). */
export function nowLocalTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

/** Affichage humain d'une date 'YYYY-MM-DD', ex. « 12 août 2026 ». */
export function formatDateLong(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/** Affichage court d'une heure 'HH:mm:ss' ou 'HH:mm', ex. « 9 h 30 ». */
export function formatTimeShort(time: string): string {
  const [h, m] = time.split(":");
  return `${Number(h)} h ${m}`;
}

// Arithmétique de calendrier pure (année/mois/jour, ancrée à midi UTC) —
// jamais de nouvelle lecture de « maintenant » ici, donc pas de risque de
// rejouer le bug D18. Seule todayLocal() lit l'heure réelle.
function versDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

function versIso(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function addDaysLocal(isoDate: string, jours: number): string {
  const date = versDate(isoDate);
  date.setUTCDate(date.getUTCDate() + jours);
  return versIso(date);
}

/** Lundi de la semaine contenant isoDate. */
export function startOfWeekLocal(isoDate: string): string {
  const date = versDate(isoDate);
  const jourSemaine = (date.getUTCDay() + 6) % 7; // 0 = lundi
  return addDaysLocal(isoDate, -jourSemaine);
}
