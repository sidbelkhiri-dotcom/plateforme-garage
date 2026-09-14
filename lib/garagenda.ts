// Identité de l'entreprise qui exploite Garagenda, publiée dans sa
// politique de confidentialité (app/confidentialite).
//
// La Loi 25 exige de publier le titre et les coordonnées du responsable de
// la protection des renseignements personnels. Tant que ces valeurs sont
// nulles, la page le dit franchement plutôt que d'afficher une identité
// inventée — À COMPLÉTER avant d'accueillir un premier garage.
export const ENTREPRISE = {
  /** Raison sociale ou nom de l'exploitant. */
  nom: null as string | null,
  /** Nom du responsable de la protection des renseignements personnels. */
  responsable: null as string | null,
  /** Son titre, ex. « Président ». */
  titreResponsable: null as string | null,
  /** Courriel pour les demandes d'accès, de correction ou de suppression. */
  courriel: null as string | null,
  /** Date de la dernière mise à jour de la politique, AAAA-MM-JJ. */
  miseAJour: "2026-09-14",
};

/**
 * Prestataires qui traitent des renseignements pour Garagenda. À tenir à jour
 * à chaque nouveau service : la politique doit dire vrai, et une communication
 * hors du Québec exige une évaluation des facteurs relatifs à la vie privée
 * (voir docs/LOI-25.md).
 */
export const PRESTATAIRES = [
  { nom: "Supabase", role: "base de données, authentification et fichiers (photos)" },
  { nom: "Vercel", role: "hébergement de l'application" },
  { nom: "Resend", role: "envoi des courriels (évaluations, factures, invitations)" },
  { nom: "Twilio", role: "envoi des textos (rappels de rendez-vous)" },
  { nom: "Stripe", role: "paiement des abonnements des garages" },
] as const;
