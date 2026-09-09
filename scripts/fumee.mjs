// ============================================================
// Test de fumée : vérifie qu'un déploiement répond, y compris sur les
// pages rendues côté serveur, qu'on n'atteint QUE connecté.
//
// Pourquoi ce script existe. Le 9 septembre 2026, toutes les pages
// rendues côté serveur ont renvoyé 500 en production pendant près d'une
// heure. La cause était une lecture de fichier dans public/, qui
// n'existe pas dans le système de fichiers d'une fonction Vercel. Rien
// ne l'a détecté : une requête anonyme sur la racine est redirigée vers
// /login avant d'exécuter la moindre page serveur, donc tous les
// contrôles passaient au vert pendant que l'application était
// inutilisable pour ses utilisateurs.
//
// La leçon : sans session, on ne teste pas l'application, on teste sa
// page de connexion.
//
// Utilisation :
//   npm run fumee                        (local, http://localhost:3000)
//   npm run fumee -- https://exemple.app (après un déploiement)
//
// Le script crée un compte jetable, interroge les routes, puis le
// supprime — même en cas d'échec. Nécessite SUPABASE_SERVICE_ROLE_KEY
// dans .env.local.
// ============================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

function lireEnv() {
  const env = {};
  try {
    for (const ligne of readFileSync(join(racine, ".env.local"), "utf8").split("\n")) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // fichier absent : message d'erreur plus bas
  }
  return env;
}

// `rendu` distingue les pages exécutées sur le serveur de celles rendues
// par le navigateur : ce sont les premières qui tombent quand un module
// serveur échoue, et les secondes continuent de répondre 200, ce qui
// masque la panne.
const ROUTES = [
  { chemin: "/", rendu: "serveur", attendu: [200] },
  { chemin: "/factures/rapport", rendu: "serveur", attendu: [200] },
  { chemin: "/facturation", rendu: "serveur", attendu: [200, 307] },
  { chemin: "/clients", rendu: "client", attendu: [200] },
  { chemin: "/inventaire", rendu: "client", attendu: [200] },
  { chemin: "/icon.svg", rendu: "statique", attendu: [200] },
  { chemin: "/apple-icon", rendu: "statique", attendu: [200] },
  { chemin: "/manifest.webmanifest", rendu: "statique", attendu: [200] },
  { chemin: "/logo-or.png", rendu: "statique", attendu: [200] },
  { chemin: "/logo-argent.png", rendu: "statique", attendu: [200] },
];

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const env = lireEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.");
  process.exit(1);
}

const entetesAdmin = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };
const courriel = `fumee.${Date.now()}@example.com`;
const motDePasse = `Fumee${Date.now()}!`;
let idCompte = null;

async function supprimerCompte() {
  if (!idCompte) return;
  await fetch(`${url}/auth/v1/admin/users/${idCompte}`, { method: "DELETE", headers: entetesAdmin }).catch(() => {});
  idCompte = null;
}
process.on("exit", () => { if (idCompte) console.error(`\nCompte jetable à supprimer à la main : ${courriel}`); });

try {
  // email_confirm évite d'attendre un courriel de validation.
  const creation = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: entetesAdmin,
    body: JSON.stringify({ email: courriel, password: motDePasse, email_confirm: true }),
  });
  if (!creation.ok) throw new Error(`création du compte jetable : ${creation.status} ${await creation.text()}`);
  idCompte = (await creation.json()).id;

  const session = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ email: courriel, password: motDePasse }),
  }).then((r) => r.json());
  if (!session.access_token) throw new Error(`ouverture de session : ${JSON.stringify(session)}`);

  // Format attendu par @supabase/ssr côté serveur.
  const ref = new URL(url).hostname.split(".")[0];
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;

  console.log(`Cible : ${base}\n`);
  console.log("route".padEnd(28) + "rendu".padEnd(11) + "statut");
  console.log("-".repeat(52));

  let echecs = 0;
  for (const { chemin, rendu, attendu } of ROUTES) {
    let statut;
    try {
      statut = (await fetch(base + chemin, { headers: { Cookie: cookie }, redirect: "manual" })).status;
    } catch (e) {
      statut = `injoignable (${e.message})`;
    }
    const ok = attendu.includes(statut);
    if (!ok) echecs++;
    console.log(chemin.padEnd(28) + rendu.padEnd(11) + String(statut) + (ok ? "" : `   ECHEC — attendu ${attendu.join(" ou ")}`));
  }

  await supprimerCompte();

  console.log("-".repeat(52));
  if (echecs) {
    console.log(`${echecs} route(s) en échec.`);
    process.exit(1);
  }
  console.log("Tout répond comme attendu.");
} catch (erreur) {
  await supprimerCompte();
  console.error("Échec du test de fumée :", erreur.message);
  process.exit(1);
}
