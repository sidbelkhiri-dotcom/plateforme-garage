// Petites mises en forme de texte à l'écran.

/**
 * « 1 bon », « 2 bons » — plutôt que « 2 bon(s) », qui se lit comme une
 * sortie de programme. Le pluriel irrégulier se passe en troisième argument.
 */
export function pluriel(n: number, singulier: string, pluriel = `${singulier}s`): string {
  return `${new Intl.NumberFormat("fr-CA").format(n)} ${Math.abs(n) < 2 ? singulier : pluriel}`;
}

/**
 * Numéro nord-américain à dix chiffres affiché « 514 555-0142 », la forme
 * de l'Office québécois de la langue française. Un numéro saisi « 5145550001 »
 * s'affichait tel quel à côté de ceux saisis avec des tirets. Tout ce qui ne
 * ressemble pas à dix chiffres (poste, numéro étranger) est rendu intact.
 */
export function formatTelephone(valeur: string | null | undefined): string {
  if (!valeur) return "";
  const chiffres = valeur.replace(/\D/g, "");
  const dix = chiffres.length === 11 && chiffres.startsWith("1") ? chiffres.slice(1) : chiffres;
  if (dix.length !== 10) return valeur;
  return `${dix.slice(0, 3)} ${dix.slice(3, 6)}-${dix.slice(6)}`;
}
