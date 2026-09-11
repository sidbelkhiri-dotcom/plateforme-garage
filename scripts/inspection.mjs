// ============================================================
// Suite de vérification de l'accès public aux inspections.
//
// C'est le seul endroit du projet où un anonyme ÉCRIT en base. Partout
// ailleurs, un inconnu peut au mieux déposer une demande dans une file
// d'attente ; ici il lit une ressource précise et y inscrit une décision
// qui a une valeur commerciale — approuver ou refuser une réparation.
//
// Le plan d'architecture le dit sans détour : « c'est le premier patron
// d'écriture anonyme du projet, pas une variation d'un patron déjà
// éprouvé ». Il réclame six vérifications avant de lui faire confiance.
// Elles n'existaient que sous forme de commentaires à décommenter à la
// main dans une migration — autant dire qu'elles ne tournaient jamais.
//
// Le verrou n'est pas une politique RLS : les trois tables n'ont AUCUNE
// policy pour anon, et tout passe par deux fonctions security definer.
// Ce qu'on éprouve ici, c'est donc ces deux fonctions, et le fait que
// rien d'autre ne soit joignable.
//
// Le point le plus subtil est l'uniformité des messages d'erreur. Un
// jeton est un UUID : personne ne le devine par force brute. Mais si la
// fonction répond « inspection révoquée » à l'un et « introuvable » à un
// autre, elle devient un oracle : elle confirme l'existence de ce qu'on
// lui soumet. Trois causes d'échec, un seul message — c'est vérifié ici
// caractère par caractère.
//
// Utilisation :  npm run inspection
// Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local.
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

const env = lireEnv();
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_SUPABASE || !ANON || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.");
  process.exit(1);
}

const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
// La position exacte d'un attaquant : la clé publique, celle qui part
// dans le bundle du navigateur, et rien d'autre.
const anonyme = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };
const marque = `insp-${Date.now()}`;

async function srv(chemin, options = {}) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...admin, Prefer: "return=representation", ...(options.headers ?? {}) },
  });
  const texte = await r.text();
  if (!r.ok) throw new Error(`${options.method ?? "GET"} ${chemin} → ${r.status} ${texte.slice(0, 300)}`);
  return texte ? JSON.parse(texte) : null;
}

const creer = (table, donnees) => srv(table, { method: "POST", body: JSON.stringify(donnees) }).then((r) => r[0]);

/** Appel en anonyme pur. Renvoie le statut et le corps, sans jamais lever. */
async function sansCompte(chemin, options = {}) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...anonyme, ...(options.headers ?? {}) },
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { statut: r.status, corps };
}

const appeler = (fonction, args) =>
  sansCompte(`rpc/${fonction}`, { method: "POST", body: JSON.stringify(args) });

const echecs = [];
function verifier(epreuve, reussi, detail = "") {
  if (!reussi) echecs.push(`${epreuve}${detail ? " : " + detail : ""}`);
  const etiquette = reussi ? "ok" : "ÉCHEC";
  console.log("  " + epreuve.padEnd(58) + etiquette + (reussi || !detail ? "" : "  — " + detail));
  return reussi;
}

// ------------------------------------------------------------
// Mise en place : deux garages, deux inspections indépendantes.
// ------------------------------------------------------------
const aNettoyer = { garages: [] };

async function semerInspection(suffixe) {
  const garage = await creer("garages", { nom: `${marque}-${suffixe}`, statut: "actif" });
  aNettoyer.garages.push(garage.id);
  const g = garage.id;

  const dejaParams = await srv(`parametres?select=garage_id&garage_id=eq.${g}`);
  if (dejaParams.length === 0) {
    await creer("parametres", { garage_id: g, nom: `${marque}-${suffixe}`, taux_horaire: 100 });
  }

  const client = await creer("clients", { garage_id: g, nom: `${marque}-client-${suffixe}` });
  const vehicule = await creer("vehicules", { garage_id: g, client_id: client.id, marque: "Testo", modele: "Insp" });
  const bon = await creer("bons_travail", {
    garage_id: g, client_id: client.id, vehicule_id: vehicule.id,
    kilometrage: 1000, plainte_client: `${marque} plainte`, taux_horaire: 100,
    ouvert_le: new Date().toISOString().slice(0, 10),
  });
  const inspection = await creer("inspections", {
    garage_id: g, bon_travail_id: bon.id, statut: "envoyee", envoyee_le: new Date().toISOString(),
  });
  const points = [];
  for (const [i, etat] of ["a_reparer", "a_surveiller"].entries()) {
    points.push(await creer("inspection_points", {
      inspection_id: inspection.id,
      description: `${marque} point ${suffixe}${i}`,
      etat, prix_estime: 100 + i, ordre: i,
    }));
  }
  const photo = await creer("inspection_photos", {
    inspection_point_id: points[0].id, chemin: `${g}/${marque}.jpg`, type: "photo",
  });

  return { garage: g, bon: bon.id, inspection: inspection.id, jeton: inspection.jeton_acces, points, photo };
}

async function nettoyer() {
  const ORDRE = [
    "inspection_photos", "inspection_points", "inspections",
    "facture_lignes", "factures", "bon_travail_evaluations", "bon_travail_lignes",
    "bons_travail", "rendez_vous", "vehicules", "clients",
    "inventaire", "vehicules_stock", "demandes_accueil", "demandes_rendez_vous", "parametres",
  ];
  const restes = [];
  for (const g of aNettoyer.garages) {
    for (const table of ORDRE) {
      const r = await fetch(`${URL_SUPABASE}/rest/v1/${table}?garage_id=eq.${g}`, { method: "DELETE", headers: admin }).catch(() => null);
      if (r && !r.ok) restes.push(`${table} (${r.status})`);
    }
    const r = await fetch(`${URL_SUPABASE}/rest/v1/garages?id=eq.${g}`, { method: "DELETE", headers: admin }).catch(() => null);
    if (!r || !r.ok) restes.push(`garages ${g} (${r ? r.status : "réseau"})`);
  }
  if (restes.length) console.warn("\nMénage incomplet : " + restes.join(", "));
}

try {
  console.log("Mise en place de deux inspections dans deux garages distincts…\n");
  const A = await semerInspection("a");
  const B = await semerInspection("b");

  // ------------------------------------------------------------
  console.log("1. Le jeton d'une inspection n'ouvre que la sienne");
  // ------------------------------------------------------------
  const vueA = await appeler("obtenir_inspection_publique", { p_jeton: A.jeton });
  const idsVus = (vueA.corps?.points ?? []).map((p) => p.id);
  verifier("un jeton valide ouvre bien son inspection",
    vueA.statut === 200 && idsVus.length === 2, `statut ${vueA.statut}, ${idsVus.length} point(s)`);
  verifier("le jeton de A ne révèle aucun point de B",
    !B.points.some((p) => idsVus.includes(p.id)),
    "des points de l'autre inspection sont visibles");
  // La promesse de conception est précise : le chemin des photos ne doit
  // pas être corrélé AU JETON, pour qu'une photo qui fuit — un scanner de
  // courriel d'entreprise qui précharge les images, par exemple —
  // n'emporte pas le lien complet avec elle. C'est ça qu'on vérifie.
  const charge = JSON.stringify(vueA.corps ?? {});
  verifier("la réponse publique ne contient pas le jeton lui-même",
    !charge.includes(A.jeton), "le jeton se retrouve dans la charge publique");

  // Observation, pas défaut. La réponse expose le garage_id, parce que
  // les photos sont servies par leur chemin Storage, lequel est préfixé
  // par le garage depuis le cloisonnement. Ça ne donne prise à rien :
  // sans compte on ne peut ni lister le seau (fermé le 2026-09-29) ni
  // interroger les tables, et les noms de fichiers sont aléatoires. La
  // colonne identifiant_public existait pourtant pour éviter d'exposer
  // les détails du stockage — la page publique ne s'en sert que comme
  // clé React. À trancher un jour : s'en servir vraiment, ou la retirer.
  if (charge.includes(A.garage)) {
    console.log("     note : la charge publique expose le garage_id (chemin des photos) — sans effet exploitable, voir le commentaire");
  }

  // ------------------------------------------------------------
  console.log("\n2. Un jeton ne peut répondre qu'aux points de son inspection");
  // ------------------------------------------------------------
  const croise = await appeler("repondre_inspection_point", {
    p_jeton: A.jeton, p_point_id: B.points[0].id, p_decision: "approuve",
  });
  verifier("répondre à un point d'une autre inspection est refusé",
    croise.statut >= 400, `statut ${croise.statut}`);
  const [pointBApres] = await srv(`inspection_points?select=decision_client&id=eq.${B.points[0].id}`);
  verifier("le point visé n'a pas été modifié malgré tout",
    pointBApres.decision_client === null, `décision : ${pointBApres.decision_client}`);

  const propre = await appeler("repondre_inspection_point", {
    p_jeton: A.jeton, p_point_id: A.points[0].id, p_decision: "approuve",
  });
  const [pointAApres] = await srv(`inspection_points?select=decision_client&id=eq.${A.points[0].id}`);
  verifier("répondre à son propre point fonctionne",
    propre.statut < 400 && pointAApres.decision_client === "approuve",
    `statut ${propre.statut}, décision ${pointAApres.decision_client}`);

  // Le client peut-il revenir sur sa décision ? Le comportement est
  // mesuré plutôt que supposé : il engage la relation avec le garage.
  const reReponse = await appeler("repondre_inspection_point", {
    p_jeton: A.jeton, p_point_id: A.points[0].id, p_decision: "refuse",
  });
  const [pointRejoue] = await srv(`inspection_points?select=decision_client&id=eq.${A.points[0].id}`);
  console.log(`     note : répondre deux fois au même point est ${reReponse.statut < 400 ? "accepté" : "refusé"}` +
    ` — décision finale : ${pointRejoue.decision_client}`);

  // ------------------------------------------------------------
  console.log("\n3. Les trois causes d'échec donnent le MÊME message");
  // ------------------------------------------------------------
  const inexistant = await appeler("obtenir_inspection_publique", {
    p_jeton: "00000000-0000-0000-0000-000000000000",
  });

  await srv(`inspections?id=eq.${B.inspection}`, { method: "PATCH", body: JSON.stringify({ revoque: true }) });
  const revoque = await appeler("obtenir_inspection_publique", { p_jeton: B.jeton });

  const C = await semerInspection("c");
  await srv(`inspections?id=eq.${C.inspection}`, {
    method: "PATCH", body: JSON.stringify({ expire_le: new Date(Date.now() - 86400000).toISOString() }),
  });
  const expire = await appeler("obtenir_inspection_publique", { p_jeton: C.jeton });

  const messages = [inexistant, revoque, expire].map((r) => r.corps?.message ?? `statut ${r.statut}`);
  verifier("un jeton inexistant est refusé", inexistant.statut >= 400, `statut ${inexistant.statut}`);
  verifier("un jeton révoqué est refusé", revoque.statut >= 400, `statut ${revoque.statut}`);
  verifier("un jeton expiré est refusé", expire.statut >= 400, `statut ${expire.statut}`);
  verifier("les trois messages sont identiques — pas d'oracle",
    new Set(messages).size === 1, messages.join(" | "));
  console.log(`     message unique : « ${messages[0]} »`);

  // Même exigence sur l'écriture : une fonction qui distingue ses refus
  // renseigne autant qu'une qui distingue ses lectures.
  const ecritureRevoquee = await appeler("repondre_inspection_point", {
    p_jeton: B.jeton, p_point_id: B.points[0].id, p_decision: "approuve",
  });
  verifier("répondre avec un jeton révoqué donne le même message",
    ecritureRevoquee.corps?.message === messages[0],
    ecritureRevoquee.corps?.message ?? `statut ${ecritureRevoquee.statut}`);
  verifier("répondre à un point inexistant donne le même message",
    (await appeler("repondre_inspection_point", {
      p_jeton: A.jeton, p_point_id: "00000000-0000-0000-0000-000000000000", p_decision: "approuve",
    })).corps?.message === messages[0], "un point inconnu se distingue d'un jeton inconnu");

  // ------------------------------------------------------------
  console.log("\n4. Rien d'autre n'est joignable sans compte");
  // ------------------------------------------------------------
  for (const table of ["inspections", "inspection_points", "inspection_photos"]) {
    const lecture = await sansCompte(`${table}?select=id&limit=5`);
    verifier(`lire ${table} directement`,
      lecture.statut >= 400 || (Array.isArray(lecture.corps) && lecture.corps.length === 0),
      `statut ${lecture.statut}, ${lecture.corps?.length ?? "?"} ligne(s)`);
  }
  const ecritureDirecte = await sansCompte("inspection_points", {
    method: "POST", body: JSON.stringify({ inspection_id: A.inspection, description: "intrus", etat: "a_reparer" }),
  });
  verifier("écrire dans inspection_points directement",
    ecritureDirecte.statut >= 400, `statut ${ecritureDirecte.statut}`);

  // La fonction de révocation est interne : un anonyme qui pourrait
  // l'appeler couperait le lien de n'importe quel client.
  const revocation = await appeler("revoquer_inspections_bon", {});
  verifier("appeler revoquer_inspections_bon()", revocation.statut >= 400, `statut ${revocation.statut}`);

  // L'inventaire complet. Supabase accorde EXECUTE à anon sur toute
  // nouvelle fonction du schéma public : chaque fonction ajoutée sans
  // revoke explicite devient une porte, sans bruit. L'omission s'est
  // produite trois fois dans ce projet. Sonder une fonction connue ne
  // suffit donc pas — il faut comparer la liste entière à ce qu'on
  // attend, pour que l'ouverture d'une porte reste un geste conscient.
  //
  // Les six attendues, et pourquoi chacune :
  //   obtenir_inspection_publique, repondre_inspection_point
  //     Les deux portes de l'inspection — l'objet même de cette suite.
  //   obtenir_garage_public
  //     La fiche publique d'un garage par son slug, pour la prise de
  //     rendez-vous en ligne. Ne renvoie que nom, adresse, téléphone,
  //     et seulement pour un garage actif.
  //   est_role, est_admin_plateforme, garage_actuel
  //     Appelées par les politiques RLS, lesquelles s'évaluent avec les
  //     privilèges de l'appelant : les révoquer ferait échouer en
  //     « permission denied » toute requête anonyme légitime, dont la
  //     borne d'accueil. Exposition nulle — elles ne renseignent que sur
  //     l'appelant, et pour un anonyme c'est null et false.
  const ATTENDUES = [
    "est_admin_plateforme", "est_role", "garage_actuel",
    "obtenir_garage_public", "obtenir_inspection_publique", "repondre_inspection_point",
  ];
  const inventaire = await srv("rpc/fonctions_publiques", { method: "POST", body: "{}" })
    .catch(() => null);
  if (inventaire === null) {
    verifier("inventaire des fonctions publiques indisponible", false,
      "appliquer supabase/migrations/2026-10-02_inventaire_fonctions_publiques.sql");
  } else {
    const surplus = inventaire.filter((f) => !ATTENDUES.includes(f));
    const manquantes = ATTENDUES.filter((f) => !inventaire.includes(f));
    verifier("aucune fonction publique inattendue", surplus.length === 0, surplus.join(", "));
    verifier("les portes attendues sont toutes ouvertes", manquantes.length === 0, manquantes.join(", "));
  }

  // ------------------------------------------------------------
  console.log("\n5. Facturer le bon coupe le lien, comme promis");
  // ------------------------------------------------------------
  const avant = await appeler("obtenir_inspection_publique", { p_jeton: A.jeton });
  await srv(`bons_travail?id=eq.${A.bon}`, { method: "PATCH", body: JSON.stringify({ statut: "facture" }) });
  const apres = await appeler("obtenir_inspection_publique", { p_jeton: A.jeton });
  verifier("le lien fonctionnait avant la facturation", avant.statut === 200, `statut ${avant.statut}`);
  verifier("le lien est mort après la facturation", apres.statut >= 400, `statut ${apres.statut}`);
  verifier("et il donne le même message que les autres refus",
    apres.corps?.message === messages[0], apres.corps?.message ?? "");

  await nettoyer();

  console.log("\n" + "-".repeat(72));
  if (echecs.length) {
    console.log(`${echecs.length} PROBLÈME(S) :`);
    echecs.forEach((e) => console.log("  - " + e));
    process.exit(1);
  }
  console.log("Le lien d'inspection n'ouvre que ce qu'il doit, et ne renseigne sur rien d'autre.");
} catch (erreur) {
  await nettoyer();
  console.error("\nLa suite n'a pas pu aller au bout :", erreur.message);
  process.exit(1);
}
