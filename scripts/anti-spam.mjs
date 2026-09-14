// ============================================================
// Suite anti-spam : les formulaires publics d'un garage.
//
// Arrivée au comptoir et demande de rendez-vous s'ouvrent sans compte, par
// le slug du garage. Tout ce qu'un visiteur peut faire, un robot peut le
// faire mille fois, et sans passer par la page : cette suite parle donc
// directement à l'API avec la clé anonyme, comme le ferait un script.
//
// Elle vérifie que :
//   - l'écriture directe dans les tables est fermée ;
//   - les champs sont validés côté base (obligatoires, longueurs, formats) ;
//   - un double envoi ne crée pas de doublon ;
//   - un même appareil est freiné, et le reste même en falsifiant son IP ;
//   - la boîte d'un garage a un plafond, et un garage suspendu ne reçoit rien ;
//   - un anonyme ne relit jamais les demandes.
//
// Utilisation :  npm run anti-spam
// Les traces de fréquence créées par la suite sont effacées à la fin, pour
// qu'une nouvelle exécution ne se heurte pas aux limites de la précédente.
// ============================================================

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
try {
  for (const ligne of readFileSync(join(racine, ".env.local"), "utf8").split("\n")) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // fichier absent : message plus bas
}
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SUPABASE || !ANON || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.");
  process.exit(1);
}

const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const anonyme = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
const marque = `spam-${Date.now()}`;
const debut = new Date().toISOString();

async function srv(chemin, options = {}) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...admin, Prefer: "return=representation", ...(options.headers ?? {}) },
  });
  const texte = await r.text();
  if (!r.ok) throw new Error(`${options.method ?? "GET"} ${chemin} → ${r.status} ${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte) : null;
}

async function commeAnonyme(chemin, options = {}, entetes = {}) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...anonyme, Prefer: "return=representation", ...entetes },
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { statut: r.status, corps };
}
const deposer = (fonction, slug, donnees, entetes) =>
  commeAnonyme(`rpc/${fonction}`, { method: "POST", body: JSON.stringify({ p_slug: slug, p_donnees: donnees }) }, entetes);

const echecs = [];
function verifier(regle, tenue, detail = "") {
  if (!tenue) echecs.push(`${regle}${detail ? " : " + detail : ""}`);
  console.log(`  ${tenue ? "ok     " : "ÉCHEC  "}${regle}${tenue || !detail ? "" : "  — " + detail}`);
  return tenue;
}
const refusAvec = (r, fragment) => r.statut >= 400 && r.corps?.code === "P0001" && String(r.corps?.message).includes(fragment);

const garages = [];
async function nettoyer() {
  for (const g of garages) {
    for (const table of ["demandes_accueil", "demandes_rendez_vous", "parametres"]) {
      await fetch(`${URL_SUPABASE}/rest/v1/${table}?garage_id=eq.${g}`, { method: "DELETE", headers: admin }).catch(() => {});
    }
    await fetch(`${URL_SUPABASE}/rest/v1/garages?id=eq.${g}`, { method: "DELETE", headers: admin }).catch(() => {});
  }
  await fetch(`${URL_SUPABASE}/rest/v1/demandes_publiques_traces?cree_le=gte.${encodeURIComponent(debut)}`, {
    method: "DELETE", headers: admin,
  }).catch(() => {});
}

async function nouveauGarage(suffixe, statut = "actif") {
  const [g] = await srv("garages", { method: "POST", body: JSON.stringify({ nom: `${marque} ${suffixe}`, statut }) });
  garages.push(g.id);
  await srv("parametres", { method: "POST", body: JSON.stringify({ garage_id: g.id, nom: `${marque} ${suffixe}` }) });
  return g;
}

const demandeRdv = (n = "") => ({
  nom: `${marque} Client ${n}`, telephone: `514555${String(1000 + Number(n || 0)).slice(-4)}`,
  courriel: "", service: "Freins", plage: "matin", message: "Bruit au freinage", consentement_communications: true,
});

try {
  console.log("Mise en place de trois garages de test…\n");
  const garage = await nouveauGarage("principal");
  const garagePlein = await nouveauGarage("plein");
  const garageSuspendu = await nouveauGarage("suspendu", "suspendu");

  // ------------------------------------------------------------
  console.log("1. Portes");
  // ------------------------------------------------------------
  // return=minimal : sinon PostgREST tente de relire la ligne insérée, ce
  // qu'un anonyme n'a pas le droit de faire, et l'insertion paraît refusée
  // alors qu'elle a eu lieu. La première version de cette sonde « passait »
  // pour cette raison, écriture pourtant ouverte. On compte donc en base.
  for (const table of ["demandes_rendez_vous", "demandes_accueil"]) {
    const direct = await commeAnonyme(table, {
      method: "POST", body: JSON.stringify({ garage_id: garage.id, nom: `${marque} direct` }),
    }, { Prefer: "return=minimal" });
    const inserees = await srv(`${table}?select=id&garage_id=eq.${garage.id}&nom=eq.${encodeURIComponent(`${marque} direct`)}`);
    verifier(`l'écriture directe dans ${table} est fermée`, inserees.length === 0,
      `statut ${direct.statut}, ${inserees.length} ligne(s) créée(s)`);
    if (inserees.length) await srv(`${table}?id=eq.${inserees[0].id}`, { method: "DELETE" });
  }
  const traces = await commeAnonyme("demandes_publiques_traces?select=*");
  verifier("un anonyme ne lit pas les traces de fréquence",
    traces.statut >= 400 || (Array.isArray(traces.corps) && traces.corps.length === 0), `statut ${traces.statut}`);

  const suspendu = await deposer("deposer_demande_rendez_vous", garageSuspendu.slug, demandeRdv());
  verifier("un garage suspendu ne reçoit pas de demande", refusAvec(suspendu, "n'accepte pas"),
    `statut ${suspendu.statut} ${suspendu.corps?.message ?? ""}`);
  const inconnu = await deposer("deposer_demande_rendez_vous", `${marque}-inexistant`, demandeRdv());
  verifier("un slug inconnu est refusé", refusAvec(inconnu, "n'accepte pas"), `statut ${inconnu.statut}`);

  // ------------------------------------------------------------
  console.log("\n2. Validation côté base");
  // ------------------------------------------------------------
  // Chaque refus de validation a lieu AVANT le contrôle de fréquence : ces
  // envois ne consomment pas le quota de l'appareil.
  const cas = [
    ["un nom vide est refusé", { ...demandeRdv(), nom: "   " }, "Indiquez votre nom"],
    ["sans téléphone ni courriel, la demande de rendez-vous est refusée", { ...demandeRdv(), telephone: "", courriel: "" }, "téléphone ou un courriel"],
    ["un message de 2 001 caractères est refusé", { ...demandeRdv(), message: "x".repeat(2001) }, "trop long"],
    ["un nom de 121 caractères est refusé", { ...demandeRdv(), nom: "x".repeat(121) }, "trop long"],
    ["un courriel malformé est refusé", { ...demandeRdv(), courriel: "pas-un-courriel" }, "courriel"],
    ["un téléphone trop court est refusé", { ...demandeRdv(), telephone: "123" }, "dix chiffres"],
    ["une date passée est refusée", { ...demandeRdv(), date_souhaitee: "2020-01-01" }, "date"],
    ["une plage horaire inventée est refusée", { ...demandeRdv(), plage: "minuit" }, "Moment"],
  ];
  for (const [regle, donnees, fragment] of cas) {
    const r = await deposer("deposer_demande_rendez_vous", garage.slug, donnees);
    verifier(regle, refusAvec(r, fragment), `statut ${r.statut} ${r.corps?.message ?? ""}`);
  }
  const vinLong = await deposer("deposer_demande_accueil", garage.slug, { nom: `${marque} NIV`, vin: "X".repeat(21) });
  verifier("un NIV de 21 caractères est refusé à l'accueil", refusAvec(vinLong, "trop long"), `statut ${vinLong.statut}`);

  // ------------------------------------------------------------
  console.log("\n3. Dépôt légitime et double envoi");
  // ------------------------------------------------------------
  const premiere = await deposer("deposer_demande_rendez_vous", garage.slug, demandeRdv(1));
  verifier("une demande valide est acceptée", premiere.statut < 400 && premiere.corps?.ok === true,
    `statut ${premiere.statut} ${JSON.stringify(premiere.corps)}`);
  const [enregistree] = await srv(`demandes_rendez_vous?select=garage_id,consentement_communications,plage&garage_id=eq.${garage.id}`);
  verifier("elle arrive dans la boîte du bon garage, consentement compris",
    enregistree?.garage_id === garage.id && enregistree?.consentement_communications === true, JSON.stringify(enregistree));

  const doublon = await deposer("deposer_demande_rendez_vous", garage.slug, demandeRdv(1));
  const nombre = (await srv(`demandes_rendez_vous?select=id&garage_id=eq.${garage.id}`)).length;
  verifier("un double envoi répond « reçu » sans créer de doublon",
    doublon.statut < 400 && doublon.corps?.doublon === true && nombre === 1, `réponse ${JSON.stringify(doublon.corps)}, ${nombre} ligne(s)`);

  const lecture = await commeAnonyme(`demandes_rendez_vous?select=id&garage_id=eq.${garage.id}`);
  verifier("un anonyme ne relit pas les demandes déposées",
    lecture.statut >= 400 || (Array.isArray(lecture.corps) && lecture.corps.length === 0), `${lecture.corps?.length ?? "?"} ligne(s)`);

  const accueil = await deposer("deposer_demande_accueil", garage.slug, {
    nom: `${marque} Arrivée`, telephone: "5145550999", marque: "Honda", modele: "Civic", annee: "2019", plainte: "Vibration",
  });
  verifier("une arrivée au comptoir valide est acceptée", accueil.statut < 400 && accueil.corps?.ok === true,
    `statut ${accueil.statut} ${JSON.stringify(accueil.corps)}`);

  // ------------------------------------------------------------
  console.log("\n4. Fréquence par appareil");
  // ------------------------------------------------------------
  // Deux envois déjà comptés (la demande et son double). La limite est de
  // trois par appareil, par garage, sur dix minutes.
  let refusA = null;
  for (let i = 2; i <= 5 && refusA === null; i++) {
    const r = await deposer("deposer_demande_rendez_vous", garage.slug, demandeRdv(i));
    if (r.statut >= 400) refusA = { tentative: i, r };
  }
  const appareilFreine = refusA !== null && refusAvec(refusA.r, "Trop de demandes");
  verifier("un même appareil est freiné après trois envois en dix minutes", appareilFreine,
    refusA ? `refus à l'envoi ${refusA.tentative} : ${refusA.r.corps?.message}` : "aucun refus après cinq envois — l'IP n'est peut-être pas transmise à la base");

  if (appareilFreine) {
    const falsifie = await deposer("deposer_demande_rendez_vous", garage.slug, demandeRdv(9), {
      "X-Forwarded-For": "203.0.113.77", "X-Real-IP": "203.0.113.77",
    });
    verifier("falsifier son adresse IP dans les en-têtes ne lève pas le frein", refusAvec(falsifie, "Trop de demandes"),
      `statut ${falsifie.statut} ${falsifie.corps?.message ?? JSON.stringify(falsifie.corps)}`);
  }

  // ------------------------------------------------------------
  console.log("\n5. Plafond par garage");
  // ------------------------------------------------------------
  // Trente demandes déjà reçues dans l'heure, posées avec la clé service :
  // la trente et unième est refusée, quel que soit l'appareil.
  const lot = Array.from({ length: 30 }, (_, i) => ({ garage_id: garagePlein.id, nom: `${marque} lot ${i}`, telephone: "5145550000" }));
  await srv("demandes_rendez_vous", { method: "POST", body: JSON.stringify(lot) });
  const plafond = await deposer("deposer_demande_rendez_vous", garagePlein.slug, demandeRdv(42));
  verifier("au-delà de 30 demandes de rendez-vous dans l'heure, le garage n'en reçoit plus",
    refusAvec(plafond, "beaucoup de demandes"), `statut ${plafond.statut} ${plafond.corps?.message ?? ""}`);

  await nettoyer();
  console.log("\n" + "-".repeat(72));
  if (echecs.length) {
    console.log(`${echecs.length} RÈGLE(S) NON TENUE(S) :`);
    echecs.forEach((e) => console.log("  - " + e));
    process.exit(1);
  }
  console.log("Les formulaires publics tiennent face à un envoi automatisé.");
} catch (erreur) {
  await nettoyer();
  console.error("\nLa suite n'a pas pu aller au bout :", erreur.message);
  process.exit(1);
}
