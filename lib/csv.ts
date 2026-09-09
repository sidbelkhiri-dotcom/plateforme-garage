// Règles d'écriture d'un fichier CSV destiné à un comptable québécois.
// Deux détails décident si le fichier s'ouvre correctement, et ils sont
// propres au français :
//
// 1. Le séparateur est le point-virgule, pas la virgule. En français la
//    virgule sépare les décimales — un fichier « 1,234.56 » séparé par
//    des virgules se disloque à l'ouverture.
// 2. Le contenu commence par une marque d'ordre d'octets. Sans elle,
//    Excel lit l'UTF-8 comme du latin-1 et « Réparation » devient
//    « RÃ©paration ».
//
// Les montants sortent en nombres bruts à virgule décimale, sans symbole
// ni séparateur de milliers : c'est ce qu'attend un import comptable.

export const SEPARATEUR_CSV = ";";
const BOM = "﻿";

export function csvNombre(n: number) {
  return n.toFixed(2).replace(".", ",");
}

/** Entoure de guillemets si la valeur contient le séparateur, un
 *  guillemet ou un saut de ligne ; les guillemets internes sont doublés. */
export function csvChamp(valeur: string) {
  return /[;"\n\r]/.test(valeur) ? `"${valeur.replace(/"/g, '""')}"` : valeur;
}

export function construireCsv(entetes: string[], lignes: (string | number)[][]) {
  return (
    BOM +
    [entetes, ...lignes]
      .map((ligne) => ligne.map((v) => csvChamp(String(v))).join(SEPARATEUR_CSV))
      .join("\r\n")
  );
}

/** Déclenche le téléchargement côté navigateur. */
export function telechargerCsv(contenu: string, nomFichier: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8;" }));
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  URL.revokeObjectURL(url);
}
