// ============================================================
// Sauvegarde complète des données vers un dossier local.
//
// Pourquoi ce script plutôt qu'un pg_dump : la STRUCTURE de la base
// (tables, fonctions, déclencheurs, règles de sécurité) est déjà
// versionnée dans supabase/migrations/ sur GitHub — reconstruire une
// base vide à l'identique est donc toujours possible. Ce qui n'existe
// nulle part ailleurs, ce sont les DONNÉES. C'est ce que ce script
// copie, sans dépendre de pg_dump ni du CLI Supabase.
//
// Utilisation :  npm run sauvegarde
//
// Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local — cette clé
// contourne toutes les règles de sécurité, donc elle ne doit JAMAIS
// être publiée ni préfixée NEXT_PUBLIC_. Elle se trouve dans
// Supabase → Settings → API → service_role.
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

// .env.local n'est lu automatiquement que par Next — ici on le fait à la
// main plutôt que d'ajouter une dépendance juste pour ça.
function lireEnv() {
  const env = {};
  try {
    for (const ligne of readFileSync(join(racine, ".env.local"), "utf8").split("\n")) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fichier absent : on retombera sur le message d'erreur plus bas
  }
  return env;
}

// Toutes les tables de données. Les tables ref_* (catalogues marques,
// modèles, pièces) sont incluses : elles se rechargent depuis les
// migrations, mais les avoir ici rend la restauration plus simple.
const TABLES = [
  "clients",
  "vehicules",
  "bons_travail",
  "bon_travail_lignes",
  "bon_travail_evaluations",
  "factures",
  "facture_lignes",
  "inventaire",
  "rendez_vous",
  "profiles",
  "parametres",
  "demandes_accueil",
  "vehicules_stock",
  "ref_marques",
  "ref_vehicule_ymm",
  "ref_pieces",
];

const env = lireEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const cle = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !cle) {
  console.error("\n  Sauvegarde impossible : configuration manquante.\n");
  if (!url) console.error("  • NEXT_PUBLIC_SUPABASE_URL absent de .env.local");
  if (!cle) {
    console.error("  • SUPABASE_SERVICE_ROLE_KEY absent de .env.local");
    console.error("");
    console.error("    Récupère-la dans Supabase → Settings → API → service_role,");
    console.error("    puis ajoute cette ligne à la fin de .env.local :");
    console.error("");
    console.error("    SUPABASE_SERVICE_ROLE_KEY=la_cle_copiee");
  }
  console.error("");
  process.exit(1);
}

const supabase = createClient(url, cle, { auth: { persistSession: false } });

// Horodatage local (pas UTC) : le nom du dossier doit correspondre à
// l'heure qu'il est vraiment pour la personne qui lance la sauvegarde.
const d = new Date();
const p = (n) => String(n).padStart(2, "0");
const horodatage = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}`;

const dossier = join(racine, "sauvegardes", horodatage);
mkdirSync(dossier, { recursive: true });

console.log(`\n  Sauvegarde MECAFORCE — ${horodatage}\n`);

let total = 0;
let echecs = 0;
const resume = {};

for (const table of TABLES) {
  process.stdout.write(`  ${table.padEnd(26)}`);

  // Pagination : au-delà de 1000 lignes, PostgREST tronque en silence.
  // Sans cette boucle, une sauvegarde d'apparence réussie serait
  // incomplète — le pire cas possible pour une sauvegarde.
  const lignes = [];
  let debut = 0;
  const PAS = 1000;
  let erreur = null;

  for (;;) {
    const { data, error } = await supabase.from(table).select("*").range(debut, debut + PAS - 1);
    if (error) {
      erreur = error;
      break;
    }
    lignes.push(...data);
    if (data.length < PAS) break;
    debut += PAS;
  }

  if (erreur) {
    console.log(`échec — ${erreur.message}`);
    echecs++;
    continue;
  }

  writeFileSync(join(dossier, `${table}.json`), JSON.stringify(lignes, null, 2), "utf8");
  resume[table] = lignes.length;
  total += lignes.length;
  console.log(`${String(lignes.length).padStart(6)} ligne(s)`);
}

writeFileSync(
  join(dossier, "_resume.json"),
  JSON.stringify(
    {
      date: d.toISOString(),
      projet: url,
      tables: resume,
      total_lignes: total,
      tables_en_echec: echecs,
      note:
        "Données seulement. La structure (tables, fonctions, déclencheurs, " +
        "règles de sécurité) est dans supabase/migrations/ sur GitHub.",
    },
    null,
    2
  ),
  "utf8"
);

console.log(`\n  ${total} ligne(s) sauvegardée(s) dans sauvegardes/${horodatage}/`);
if (echecs > 0) {
  console.log(`  ${echecs} table(s) en échec — sauvegarde INCOMPLÈTE.\n`);
  process.exit(1);
}
console.log(`  Copie ce dossier ailleurs (iCloud, disque externe) — une`);
console.log(`  sauvegarde qui reste sur le même ordinateur n'en est pas une.\n`);
