// ============================================================
// Suite d'isolation entre garages.
//
// C'est le verrou avant d'accueillir un premier garage payant : une
// fuite entre locataires n'est pas un bug, c'est un événement qui tue
// l'entreprise. Un garagiste qui aperçoit les clients d'un concurrent,
// et le produit est mort le jour même.
//
// Il remplace supabase/tests/isolation_verification.sql, supprimé le
// 9 septembre 2026 : c'était un bloc SQL de 205 lignes à coller à la main
// dans l'éditeur Supabase. Il ne tournait donc que quand quelqu'un y pensait,
// et le 9 septembre 2026 il ne couvrait plus que 4 des 17 tables
// cloisonnées — les 13 autres avaient été ajoutées sans qu'on le mette à
// jour, dont `factures` et les tables d'inspection.
//
// Le script sème ses propres données plutôt que de s'appuyer sur celles
// présentes : sans ça la plupart des tables sont vides et « passent »
// sans rien prouver.
//
// Le détecteur a été éprouvé à l'envers le 9 septembre 2026 : en
// rejouant exactement ces sondes avec la clé service (une identité sans
// aucune cloison), la suite a signalé 31 fuites et est sortie en erreur.
// Un test qu'on n'a jamais vu échouer ne prouve rien ; celui-ci, si.
// Pour le refaire : remplacer `sessionA` par `admin` juste après
// ouvrirSession(). Quelques tables filles ressortent alors « ok » — non
// par cécité, mais parce que la sonde DELETE d'une table parente a déjà
// réussi et emporté leurs lignes en cascade avant leur tour.
//
// Utilisation :  npm run isolation
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
const marque = `iso-${Date.now()}`;

/** Appel PostgREST avec la clé service (contourne toute sécurité). */
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

// ------------------------------------------------------------
// Mise en place : deux garages complets, deux comptes ordinaires.
// ------------------------------------------------------------
const aCreer = { garages: [], utilisateurs: [] };

async function creerUtilisateur(courriel, motDePasse, garageId) {
  const r = await fetch(`${URL_SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email: courriel, password: motDePasse, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`création utilisateur : ${await r.text()}`);
  const { id } = await r.json();
  aCreer.utilisateurs.push(id);
  // Le déclencheur handle_new_user a posé un profil ; on le rattache au
  // garage voulu, en rôle admin pour que les écritures soient permises —
  // admin DU GARAGE, surtout pas admin de plateforme, qui traverse le
  // cloisonnement par conception et rendrait le test inutile.
  await srv(`profiles?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ garage_id: garageId, role: "admin", actif: true }),
  });
  return id;
}

async function semerGarage(suffixe) {
  const garage = await creer("garages", { nom: `${marque}-${suffixe}`, statut: "actif" });
  aCreer.garages.push(garage.id);
  const g = garage.id;

  const donnees = { garage_id: g };

  // parametres est clé par garage_id ; il peut déjà exister via un déclencheur.
  const dejaParams = await srv(`parametres?select=garage_id&garage_id=eq.${g}`);
  if (dejaParams.length === 0) {
    await creer("parametres", { garage_id: g, nom: `${marque}-${suffixe}`, taux_horaire: 100 });
  }

  const client = await creer("clients", { garage_id: g, nom: `${marque}-client-${suffixe}` });
  const vehicule = await creer("vehicules", { garage_id: g, client_id: client.id, marque: "Testo", modele: "Iso" });
  const bon = await creer("bons_travail", {
    garage_id: g,
    client_id: client.id,
    vehicule_id: vehicule.id,
    kilometrage: 1000,
    plainte_client: `${marque} plainte`,
    taux_horaire: 100,
    ouvert_le: new Date().toISOString().slice(0, 10),
  });
  const ligne = await creer("bon_travail_lignes", {
    bon_travail_id: bon.id,
    type: "piece",
    description: `${marque} ligne`,
    quantite: 1,
    prix_unitaire: 10,
    // Contrainte etat_piece_requis : une ligne « pièce » doit dire son état.
    etat_piece: "neuve",
  });
  const evaluation = await creer("bon_travail_evaluations", {
    bon_travail_id: bon.id,
    montant: 10,
    type: "initiale",
  });
  // Les tables filles (points, photos) reçoivent leur garage par
  // déclencheur ; `inspections` n'en a pas et l'exige explicitement.
  const inspection = await creer("inspections", { garage_id: g, bon_travail_id: bon.id });
  const point = await creer("inspection_points", {
    inspection_id: inspection.id,
    description: `${marque} point`,
    etat: "a_reparer",
  });
  const photo = await creer("inspection_photos", {
    inspection_point_id: point.id,
    chemin: `${marque}/photo.jpg`,
    type: "photo",
  });
  // La facture est normalement produite par creer_facture() ; on l'insère
  // ici directement, le but n'étant pas d'éprouver la logique de
  // facturation mais le cloisonnement de la table — c'est la plus
  // sensible du schéma, elle porte l'argent et la trace légale.
  const facture = await creer("factures", {
    garage_id: g,
    bon_travail_id: bon.id,
    client_id: client.id,
    vehicule_id: vehicule.id,
    total_ht: 10,
    total_ttc: 11.5,
  });
  const ligneFacture = await creer("facture_lignes", {
    facture_id: facture.id,
    type: "piece",
    description: `${marque} ligne facture`,
    quantite: 1,
    prix_unitaire: 10,
    etat_piece: "neuve",
  });
  const rdv = await creer("rendez_vous", {
    garage_id: g,
    client_id: client.id,
    vehicule_id: vehicule.id,
    date: new Date().toISOString().slice(0, 10),
    heure: "09:00",
    description: `${marque} rdv`,
  });
  const piece = await creer("inventaire", {
    garage_id: g,
    reference: `${marque}-${suffixe}`,
    nom: `${marque} piece`,
    quantite: 5,
    seuil: 1,
    prix: 20,
  });
  const stock = await creer("vehicules_stock", { garage_id: g, marque: "Testo", modele: "Stock" });
  const accueil = await creer("demandes_accueil", { garage_id: g, nom: `${marque} arrivee` });
  const demandeRdv = await creer("demandes_rendez_vous", { garage_id: g, nom: `${marque} demande` });

  Object.assign(donnees, {
    clients: client.id,
    vehicules: vehicule.id,
    bons_travail: bon.id,
    bon_travail_lignes: ligne.id,
    bon_travail_evaluations: evaluation.id,
    inspections: inspection.id,
    inspection_points: point.id,
    inspection_photos: photo.id,
    factures: facture.id,
    facture_lignes: ligneFacture.id,
    rendez_vous: rdv.id,
    inventaire: piece.id,
    vehicules_stock: stock.id,
    demandes_accueil: accueil.id,
    demandes_rendez_vous: demandeRdv.id,
  });
  return donnees;
}

async function ouvrirSession(courriel, motDePasse) {
  const s = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: courriel, password: motDePasse }),
  }).then((r) => r.json());
  if (!s.access_token) throw new Error(`session : ${JSON.stringify(s)}`);
  return { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" };
}

// ------------------------------------------------------------
// Vérifications
// ------------------------------------------------------------
const echecs = [];
function verifier(table, epreuve, reussi, detail = "") {
  if (!reussi) echecs.push(`${table} — ${epreuve}${detail ? " : " + detail : ""}`);
  return reussi;
}

async function commeUtilisateur(entetes, chemin, options = {}) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...entetes, Prefer: "return=representation", ...(options.headers ?? {}) },
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { statut: r.status, corps };
}

// `garages` n'a volontairement pas de `on delete cascade` : effacer un
// locataire ne doit jamais pouvoir emporter ses données d'un geste. Le
// ménage doit donc remonter la chaîne des dépendances, des feuilles vers
// la racine, sinon la base se remplit de garages de test à chaque essai.
const ORDRE_MENAGE = [
  "inspection_photos", "inspection_points", "inspections",
  "facture_lignes", "factures",
  "bon_travail_evaluations", "bon_travail_lignes", "bons_travail",
  "rendez_vous", "vehicules", "clients",
  "inventaire", "vehicules_stock",
  "demandes_accueil", "demandes_rendez_vous", "parametres",
];

async function nettoyer() {
  const restes = [];
  for (const id of aCreer.utilisateurs) {
    await fetch(`${URL_SUPABASE}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: admin }).catch(() => {});
  }
  for (const garage of aCreer.garages) {
    for (const table of ORDRE_MENAGE) {
      const r = await fetch(`${URL_SUPABASE}/rest/v1/${table}?garage_id=eq.${garage}`, {
        method: "DELETE", headers: admin,
      }).catch(() => null);
      if (r && !r.ok) restes.push(`${table} (${r.status})`);
    }
    const r = await fetch(`${URL_SUPABASE}/rest/v1/garages?id=eq.${garage}`, {
      method: "DELETE", headers: admin,
    }).catch(() => null);
    if (!r || !r.ok) restes.push(`garages ${garage} (${r ? r.status : "réseau"})`);
  }
  // Un ménage qui échoue en silence laisse croire que tout va bien alors
  // que la base de dev se remplit — on le dit, sans faire échouer la suite.
  if (restes.length) console.warn("\nMénage incomplet : " + restes.join(", "));
}

try {
  console.log("Mise en place de deux garages complets…");
  const A = await semerGarage("a");
  const B = await semerGarage("b");

  const courrielA = `${marque}-a@example.com`;
  const courrielB = `${marque}-b@example.com`;
  const motDePasse = `Iso${Date.now()}!`;
  await creerUtilisateur(courrielA, motDePasse, A.garage_id);
  await creerUtilisateur(courrielB, motDePasse, B.garage_id);
  const sessionA = await ouvrirSession(courrielA, motDePasse);

  const TABLES = Object.keys(B).filter((t) => t !== "garage_id");
  console.log(`Sondage de ${TABLES.length} tables depuis le garage A…\n`);
  console.log("table                        lecture ciblée  écriture  suppression  fuite en liste");
  console.log("-".repeat(84));

  for (const table of TABLES) {
    const idB = B[table];

    // 1. Lire une ligne précise de l'autre garage.
    const lecture = await commeUtilisateur(sessionA, `${table}?select=id&id=eq.${idB}`);
    const lectureOk = verifier(table, "lecture ciblée d'une ligne de l'autre garage",
      Array.isArray(lecture.corps) && lecture.corps.length === 0,
      `${lecture.corps?.length ?? "?"} ligne(s) visible(s)`);

    // 2. Modifier une ligne de l'autre garage.
    const ecriture = await commeUtilisateur(sessionA, `${table}?id=eq.${idB}`, {
      method: "PATCH", body: JSON.stringify({ garage_id: A.garage_id }),
    });
    const ecritureOk = verifier(table, "modification d'une ligne de l'autre garage",
      ecriture.statut >= 400 || (Array.isArray(ecriture.corps) && ecriture.corps.length === 0),
      `${ecriture.corps?.length ?? 0} ligne(s) modifiée(s)`);

    // 3. Supprimer une ligne de l'autre garage.
    const suppression = await commeUtilisateur(sessionA, `${table}?id=eq.${idB}`, { method: "DELETE" });
    const suppressionOk = verifier(table, "suppression d'une ligne de l'autre garage",
      suppression.statut >= 400 || (Array.isArray(suppression.corps) && suppression.corps.length === 0),
      `${suppression.corps?.length ?? 0} ligne(s) supprimée(s)`);

    // 4. La liste complète ne doit contenir aucune ligne de l'autre garage.
    const liste = await commeUtilisateur(sessionA, `${table}?select=id`);
    const fuite = Array.isArray(liste.corps) && liste.corps.some((l) => l.id === idB);
    const listeOk = verifier(table, "ligne de l'autre garage visible dans la liste", !fuite);

    const c = (ok) => (ok ? "ok".padEnd(15) : "FUITE".padEnd(15));
    console.log(table.padEnd(29) + c(lectureOk) + c(ecritureOk).slice(0, 10) + c(suppressionOk).slice(0, 13) + (listeOk ? "ok" : "FUITE"));
  }

  // `parametres` n'a pas de colonne id — elle est clé par garage_id — donc
  // les sondes génériques ci-dessus ne s'y appliquent pas. Elle porte les
  // numéros de TPS et TVQ du garage et son taux horaire : elle mérite son
  // propre contrôle plutôt qu'une absence silencieuse du rapport.
  const paramLecture = await commeUtilisateur(sessionA, `parametres?select=garage_id&garage_id=eq.${B.garage_id}`);
  const paramLectureOk = verifier("parametres", "lecture des paramètres de l'autre garage",
    Array.isArray(paramLecture.corps) && paramLecture.corps.length === 0,
    `${paramLecture.corps?.length ?? "?"} ligne(s)`);
  const paramEcriture = await commeUtilisateur(sessionA, `parametres?garage_id=eq.${B.garage_id}`, {
    method: "PATCH", body: JSON.stringify({ taux_horaire: 1 }),
  });
  const paramEcritureOk = verifier("parametres", "modification des paramètres de l'autre garage",
    paramEcriture.statut >= 400 || (Array.isArray(paramEcriture.corps) && paramEcriture.corps.length === 0),
    `${paramEcriture.corps?.length ?? 0} ligne(s)`);
  console.log("parametres".padEnd(29) + (paramLectureOk ? "ok".padEnd(15) : "FUITE".padEnd(15)) + (paramEcritureOk ? "ok" : "FUITE"));

  // 5. Insérer chez le voisin : le garage_id doit être refusé ou corrigé.
  const insert = await commeUtilisateur(sessionA, "clients", {
    method: "POST",
    body: JSON.stringify({ nom: `${marque}-intrusion`, garage_id: B.garage_id }),
  });
  const intrusionBloquee =
    insert.statut >= 400 ||
    (Array.isArray(insert.corps) && insert.corps[0]?.garage_id === A.garage_id);
  verifier("clients", "insertion forcée dans l'autre garage", intrusionBloquee,
    `garage_id obtenu : ${insert.corps?.[0]?.garage_id ?? insert.statut}`);
  console.log("\ninsertion forcée dans l'autre garage : " + (intrusionBloquee ? "bloquée" : "ACCEPTÉE — FUITE"));

  await nettoyer();

  console.log("\n" + "-".repeat(84));
  if (echecs.length) {
    console.log(`${echecs.length} FUITE(S) :`);
    echecs.forEach((e) => console.log("  - " + e));
    process.exit(1);
  }
  console.log("Aucune fuite : chaque garage ne voit et ne touche que ses propres données.");
} catch (erreur) {
  await nettoyer();
  console.error("\nLa suite n'a pas pu aller au bout :", erreur.message);
  process.exit(1);
}
