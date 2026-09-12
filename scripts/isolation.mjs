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
const SEAUX = ["vehicules-stock", "inspection-photos", "factures-pieces"];
const SEAUX_PUBLICS = ["vehicules-stock", "inspection-photos"];
const objetsSemes = [];
// Volontairement identiques d'un garage à l'autre — voir la collision
// dans semerGarage(). Suffixés par la marque du run pour ne pas heurter
// les restes d'une exécution précédente.
const PLAQUE_PARTAGEE = `ISO${String(Date.now()).slice(-4)}`;
const VIN_PARTAGE = `ISO${String(Date.now()).slice(-14)}`;

async function creerUtilisateur(courriel, motDePasse, garageId) {
  const r = await fetch(`${URL_SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email: courriel, password: motDePasse, email_confirm: true }),
  });
  if (!r.ok) throw new Error(`création utilisateur : ${await r.text()}`);
  const { id } = await r.json();
  aCreer.utilisateurs.push(id);
  // Le déclencheur handle_new_user a posé un profil en rôle mecanicien.
  // On le veut admin DU GARAGE — surtout pas admin de plateforme, qui
  // traverse le cloisonnement par conception et rendrait le test inutile.
  //
  // Mais on ne peut pas y arriver par un PATCH : protect_profile_role()
  // annule silencieusement tout changement de rôle demandé sans
  // auth.uid(), et la clé service n'en a pas. Le PATCH renvoie 200 et
  // laisse le compte en mecanicien. La suite a tourné ainsi jusqu'au
  // 2026-09-30, sondant les écritures avec un rôle plus faible que celui
  // qu'elle annonçait : là où une politique exige est_role('admin'), le
  // refus venait du rôle et non du cloisonnement, et le « ok » ne
  // prouvait rien.
  //
  // Le déclencheur n'est posé que sur UPDATE : on remplace donc la ligne
  // au lieu de la modifier.
  await srv(`profiles?id=eq.${id}`, { method: "DELETE" });
  await creer("profiles", { id, nom: courriel, garage_id: garageId, role: "admin", actif: true });

  // Vérifié plutôt que supposé : c'est exactement l'hypothèse qui a
  // rendu la suite trop indulgente pendant une journée.
  const [profil] = await srv(`profiles?select=role,garage_id&id=eq.${id}`);
  if (profil?.role !== "admin" || profil?.garage_id !== garageId) {
    throw new Error(`semis du compte ${courriel} : rôle ${profil?.role}, garage ${profil?.garage_id} — attendu admin dans ${garageId}`);
  }
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
  // Collision volontaire. Les deux garages immatriculent délibérément la
  // même plaque et le même NIV : les index uniques ont été repartitionnés
  // en (garage_id, upper(plaque)) le 2026-09-02, sans quoi le deuxième
  // garage à voir un véhicule déjà connu ailleurs se ferait refuser — et
  // apprendrait au passage qu'un autre garage l'a en fiche.
  const vehicule = await creer("vehicules", {
    garage_id: g, client_id: client.id, marque: "Testo", modele: "Iso",
    plaque: PLAQUE_PARTAGEE, vin: VIN_PARTAGE,
  });
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
    numero_bon: bon.numero,
    numero_facture: facture.numero,
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
  // Un détail de 45 éléments sur une seule ligne n'est pas un rapport,
  // c'est un mur. On montre les premiers et on dit combien il en reste.
  if (detail.length > 180) {
    const morceaux = detail.split(", ");
    detail = morceaux.slice(0, 3).join(", ") + ` … et ${morceaux.length - 3} autres`;
  }
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
  for (const [seau, chemin] of objetsSemes) {
    await fetch(`${URL_SUPABASE}/storage/v1/object/${seau}/${chemin}`, {
      method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    }).catch(() => {});
  }
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

// ------------------------------------------------------------
// Ce que la suite ne sonde pas, elle ne le prouve pas — et une liste de
// tables écrite à la main vieillit mal. L'ancien test SQL est tombé à 4
// tables sur 17 par ce seul mécanisme, et le 9 septembre 2026 la suite
// était verte tout en étant aveugle sur Storage. On compare donc la
// couverture au schéma réel : toute table portant garage_id, tout seau
// qui apparaît, et qui n'est pas sondé, fait échouer la suite. Un trou
// doit coûter un échec, pas passer inaperçu.
// ------------------------------------------------------------
async function verifierCouverture(tablesSondees) {
  const brut = await fetch(`${URL_SUPABASE}/rest/v1/`, { headers: admin }).then((r) => r.text());
  // Le descripteur contient des caractères de contrôle bruts qui font
  // échouer JSON.parse — on les neutralise avant d'analyser.
  const defs = JSON.parse(brut.replace(/[\x00-\x1f]/g, " ")).definitions;
  const cloisonnees = Object.keys(defs).filter((t) => defs[t].properties?.garage_id);
  const sondees = [...tablesSondees, "parametres"];
  const oubliees = cloisonnees.filter((t) => !sondees.includes(t));

  const seaux = await fetch(`${URL_SUPABASE}/storage/v1/bucket`, { headers: admin }).then((r) => r.json());
  const seauxOublies = (Array.isArray(seaux) ? seaux.map((b) => b.name) : []).filter((n) => !SEAUX.includes(n));

  verifier("couverture", "table portant garage_id jamais sondée", oubliees.length === 0, oubliees.join(", "));
  verifier("couverture", "seau Storage jamais sondé", seauxOublies.length === 0, seauxOublies.join(", "));
  console.log(`Couverture : ${sondees.length} tables sur ${cloisonnees.length} cloisonnées, ${SEAUX.length} seaux sur ${Array.isArray(seaux) ? seaux.length : "?"}.`);
}

// ------------------------------------------------------------
// L'angle mort inverse. La suite ne sonde que ce qu'elle sème : elle ne
// peut pas voir une table arrivée sans cloison du tout, ni une politique
// écrite à la main qui oublie garage_actuel() pendant que ses voisines
// l'ont — la forme exacte du bug d'inspection-photos. auditer_cloisonnement()
// interroge le catalogue et répond à cette question-là.
// ------------------------------------------------------------
async function auditerSchema() {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/rpc/auditer_cloisonnement`, {
    method: "POST", headers: admin, body: "{}",
  });
  if (!r.ok) {
    const texte = await r.text();
    if (texte.includes("PGRST202") || r.status === 404) {
      // Sauter l'audit en silence rendrait la suite verte tout en la
      // rendant aveugle — précisément ce qu'on cherche à empêcher.
      verifier("schéma", "auditer_cloisonnement() absente de la base", false,
        "appliquer supabase/migrations/2026-09-30_auditer_cloisonnement.sql");
      console.log("Audit du schéma : IMPOSSIBLE — migration 2026-09-30 non appliquée.\n");
      return;
    }
    throw new Error(`audit du schéma : ${r.status} ${texte.slice(0, 200)}`);
  }
  const audit = await r.json();
  const LIBELLES = {
    rls_desactivee: "table publique sans RLS",
    rls_sans_politique: "table avec RLS mais aucune politique",
    politiques_non_cloisonnees: "politique ignorant garage_actuel()",
    fonctions_search_path_mutable: "fonction security definer sans search_path fixé",
    vues_security_definer: "vue en security definer",
  };
  let total = 0;
  for (const [cle, libelle] of Object.entries(LIBELLES)) {
    const trouves = audit[cle] ?? [];
    total += trouves.length;
    verifier("schéma", libelle, trouves.length === 0,
      trouves.map((t) => (typeof t === "string" ? t : `${t.table}.${t.politique} (${t.commande})`)).join(", "));
  }
  console.log(`Audit du schéma : ${total === 0 ? "rien à signaler" : total + " point(s) à corriger"}.`);
}

try {
  console.log("Mise en place de deux garages complets…");
  const A = await semerGarage("a");
  const B = await semerGarage("b");

  const courrielA = `${marque}-a@example.com`;
  const courrielB = `${marque}-b@example.com`;
  const motDePasse = `Iso${Date.now()}!`;
  // `profiles` porte garage_id comme les autres, mais sa ligne est posée
  // par le déclencheur handle_new_user, pas par semerGarage — d'où ce
  // rattachement après coup, sans quoi la table échapperait aux sondes.
  A.profiles = await creerUtilisateur(courrielA, motDePasse, A.garage_id);
  B.profiles = await creerUtilisateur(courrielB, motDePasse, B.garage_id);
  const sessionA = await ouvrirSession(courrielA, motDePasse);

  const TABLES = Object.keys(B).filter((t) => !["garage_id", "numero_bon", "numero_facture"].includes(t));
  await verifierCouverture(TABLES);
  await auditerSchema();
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

  // ------------------------------------------------------------
  // 5 bis. Numérotation. Les séquences globales BT-/FA- ont été
  //   remplacées le 2026-09-09 par un compteur par garage. Deux garages
  //   neufs doivent donc tous deux commencer à 0001 : si l'un repart où
  //   l'autre s'est arrêté, les numéros s'entremêlent, et un garage peut
  //   déduire le volume d'affaires de ses voisins en regardant les trous
  //   dans sa propre suite. Sur une facture, la suite est en outre une
  //   obligation comptable, pas un confort.
  // ------------------------------------------------------------
  const numerosOk =
    A.numero_bon === B.numero_bon && A.numero_facture === B.numero_facture;
  verifier("numérotation", "deux garages neufs ne commencent pas au même numéro", numerosOk,
    `A : ${A.numero_bon}/${A.numero_facture}, B : ${B.numero_bon}/${B.numero_facture}`);
  console.log(`\nNumérotation — garage A : ${A.numero_bon} et ${A.numero_facture}, garage B : ${B.numero_bon} et ${B.numero_facture}` +
    (numerosOk ? " (compteurs indépendants)" : " — ENTREMÊLÉS"));
  // Une ligne d'affichage ne prouve rien : on vérifie que la collision a
  // bien eu lieu en base. Si l'index redevenait global, le deuxième semis
  // échouerait et la suite s'arrêterait avant d'arriver ici — mais si la
  // plaque cessait d'être partagée, le test deviendrait creux sans que
  // rien ne le signale. C'est ce second cas que cette assertion couvre.
  const memePlaque = await srv(`vehicules?select=garage_id&plaque=eq.${PLAQUE_PARTAGEE}`);
  const garagesDistincts = new Set(memePlaque.map((v) => v.garage_id));
  verifier("collision", "la même plaque n'est pas immatriculée dans les deux garages",
    garagesDistincts.size === 2, `${garagesDistincts.size} garage(s)`);
  console.log(`Collision volontaire — la plaque ${PLAQUE_PARTAGEE} est immatriculée dans ${garagesDistincts.size} garages : acceptée.`);

  // ------------------------------------------------------------
  // 6. Storage. Les fichiers ne sont pas des lignes : RLS sur les tables
  //    ne les protège en rien, et c'est exactement là que la suite était
  //    aveugle quand elle a été écrite. Le 9 septembre 2026, une sonde
  //    manuelle y a trouvé une vraie fuite (`inspection-photos` laissait
  //    lister le dossier du voisin) — d'où ce volet, pour qu'elle ne
  //    puisse plus se rouvrir sans que personne ne le voie.
  // ------------------------------------------------------------
  console.log("\nseau                 dépôt chez B   liste de B   lecture de B     suppression chez B");
  console.log("-".repeat(84));
  for (const seau of SEAUX) {
    const chemin = `${B.garage_id}/${marque}.txt`;
    // Semé avec la clé service : on éprouve l'accès, pas la création.
    await fetch(`${URL_SUPABASE}/storage/v1/object/${seau}/${chemin}`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "text/plain" },
      body: "donnees du garage B",
    });
    objetsSemes.push([seau, chemin]);

    const depot = await fetch(`${URL_SUPABASE}/storage/v1/object/${seau}/${B.garage_id}/${marque}-intrus.txt`, {
      method: "POST", headers: { ...sessionA, "Content-Type": "text/plain" }, body: "intrusion",
    });
    if (depot.ok) objetsSemes.push([seau, `${B.garage_id}/${marque}-intrus.txt`]);
    const depotOk = verifier(seau, "dépôt d'un fichier chez l'autre garage", depot.status >= 400, `statut ${depot.status}`);

    const liste = await fetch(`${URL_SUPABASE}/storage/v1/object/list/${seau}`, {
      method: "POST", headers: { ...sessionA, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: `${B.garage_id}/`, limit: 50 }),
    }).then((r) => r.json()).catch(() => null);
    const listeOk = verifier(seau, "listage du dossier de l'autre garage",
      !Array.isArray(liste) || liste.length === 0, `${Array.isArray(liste) ? liste.length : "?"} objet(s)`);

    // Sur un seau public, lire par chemin ne consulte aucune politique :
    // c'est le drapeau `public` du seau, le compromis assumé rappelé plus
    // bas. Le compter comme une fuite ferait crier la suite sur un choix
    // délibéré, et une suite qui crie pour rien finit ignorée. Ce qui doit
    // rester verrouillé même sur un seau public, c'est le LISTAGE : sans
    // lui, le chemin reste un UUID indevinable ; avec lui, plus rien à
    // deviner. Sur un seau privé, en revanche, la lecture doit échouer.
    const lecture = await fetch(`${URL_SUPABASE}/storage/v1/object/${seau}/${chemin}`, { headers: sessionA });
    const estPublic = SEAUX_PUBLICS.includes(seau);
    const lectureOk = estPublic
      ? true
      : verifier(seau, "lecture d'un fichier de l'autre garage", lecture.status >= 400, `statut ${lecture.status}`);

    const suppression = await fetch(`${URL_SUPABASE}/storage/v1/object/${seau}/${chemin}`, { method: "DELETE", headers: sessionA });
    const supprOk = verifier(seau, "suppression d'un fichier de l'autre garage", suppression.status >= 400, `statut ${suppression.status}`);

    const c = (ok) => (ok ? "ok" : "FUITE");
    const lectureAffichee = estPublic ? "public (assumé)" : c(lectureOk);
    console.log(seau.padEnd(21) + c(depotOk).padEnd(15) + c(listeOk).padEnd(13) + lectureAffichee.padEnd(17) + c(supprOk));
  }
  // Les seaux publics sont lisibles par URL sans aucune clé — c'est le
  // drapeau `public` du seau, pas une politique, et c'est voulu : le
  // client doit voir ses photos d'inspection sans compte. On l'affiche
  // pour que ce compromis reste sous les yeux, sans faire échouer la suite.
  console.log("\nRappel — seaux publics en lecture par URL (assumé) : " + SEAUX_PUBLICS.join(", "));

  // ------------------------------------------------------------
  // 7. L'autre moitié. Tout ce qui précède vérifie que l'interdit reste
  //    interdit ; rien ne vérifiait que le permis reste permis. Une
  //    politique trop serrée passe donc toutes les sondes ci-dessus avec
  //    un sans-faute, en ayant coupé le garage de ses propres données.
  //    Le 2026-09-30, faute de ce contrôle, j'ai cru vingt minutes durant
  //    avoir cassé la gestion du personnel.
  // ------------------------------------------------------------
  console.log("\nAccès légitime du garage à ses propres données :");
  for (const table of TABLES) {
    const lecture = await commeUtilisateur(sessionA, `${table}?select=id&id=eq.${A[table]}`);
    verifier(table, "le garage ne voit plus sa propre ligne",
      Array.isArray(lecture.corps) && lecture.corps.length === 1,
      `${lecture.corps?.length ?? "?"} ligne(s)`);
  }
  // Une écriture réelle sur trois tables représentatives : la lecture
  // seule ne dirait rien d'un UPDATE devenu trop strict.
  const ECRITURES = [
    ["clients", { notes: `${marque} note` }],
    ["inventaire", { quantite: 4 }],
    ["profiles", { nom: `${marque} employé` }],
  ];
  for (const [table, corps] of ECRITURES) {
    const r = await commeUtilisateur(sessionA, `${table}?id=eq.${A[table]}`, {
      method: "PATCH", body: JSON.stringify(corps),
    });
    verifier(table, "le garage ne peut plus modifier sa propre ligne",
      r.statut < 400 && Array.isArray(r.corps) && r.corps.length === 1,
      `statut ${r.statut}, ${r.corps?.length ?? 0} ligne(s)`);
  }
  // Les déclencheurs doivent encore tourner pour un employé connecté.
  // Le 2026-10-03 on a révoqué EXECUTE à public/anon/authenticated sur
  // fixer_garage_inspection_points et fixer_garage_inspection_photos :
  // Postgres ne vérifie pas ce droit au déclenchement d'un trigger, donc
  // rien n'a cassé — mais c'est le genre d'hypothèse qui mérite une
  // sonde plutôt qu'une confiance. Les deux suites sèment tout avec la
  // clé service : sans ce contrôle, aucune ne passerait par le chemin
  // d'un vrai employé, et une régression resterait invisible.
  const pointSeme = await commeUtilisateur(sessionA, "inspection_points", {
    method: "POST",
    body: JSON.stringify({ inspection_id: A.inspections, description: `${marque} par employé`, etat: "a_reparer", ordre: 9 }),
  });
  const garagePose = Array.isArray(pointSeme.corps) ? pointSeme.corps[0]?.garage_id : null;
  verifier("inspection_points", "un employé ne peut plus créer de point d'inspection",
    pointSeme.statut < 400, `statut ${pointSeme.statut}`);
  verifier("inspection_points", "le déclencheur ne pose plus le garage_id",
    garagePose === A.garage_id, `garage_id obtenu : ${garagePose}`);

  console.log(`  ${TABLES.length} lectures, ${ECRITURES.length} écritures et 1 déclencheur sur ses propres données.`);

  // ------------------------------------------------------------
  // 8. Cycle de vie. Suspendre un garage doit l'empêcher de travailler
  //    sans lui cacher ses propres données : ses factures sont des
  //    pièces comptables qu'il doit pouvoir produire. Le 2026-09-11, la
  //    suspension n'existait que dans middleware.ts — le jeton d'un
  //    employé continuait d'écrire par l'API, dans les quatre états.
  //    Cette section doit rester la dernière : elle change l'état de A.
  // ------------------------------------------------------------
  console.log("\nCycle de vie du garage :");
  const etatGarage = (donnees) => srv(`garages?id=eq.${A.garage_id}`, { method: "PATCH", body: JSON.stringify(donnees) });
  const sonderEtat = async (etiquette) => {
    const lecture = await commeUtilisateur(sessionA, `clients?select=id&id=eq.${A.clients}`);
    const ecriture = await commeUtilisateur(sessionA, "clients", {
      method: "POST", body: JSON.stringify({ nom: `${marque}-${etiquette.replace(/\W+/g, "")}` }),
    });
    return {
      litEncore: Array.isArray(lecture.corps) && lecture.corps.length === 1,
      ecritEncore: ecriture.statut < 400 && Array.isArray(ecriture.corps) && ecriture.corps.length === 1,
      statut: ecriture.statut,
    };
  };

  for (const [etiquette, donnees] of [
    ["suspendu par le super-admin", { statut: "suspendu" }],
    ["abonnement en échec", { statut: "actif", abonnement_statut: "past_due" }],
    ["résilié", { statut: "resilie", abonnement_statut: null }],
  ]) {
    await etatGarage(donnees);
    const r = await sonderEtat(etiquette);
    verifier("cycle de vie", `${etiquette} — le garage ne voit plus ses données`, r.litEncore);
    verifier("cycle de vie", `${etiquette} — le garage peut encore écrire`, !r.ecritEncore, `statut ${r.statut}`);
    console.log(`  ${etiquette.padEnd(30)} lecture ${r.litEncore ? "ok" : "PERDUE"}   écriture ${r.ecritEncore ? "TOUJOURS POSSIBLE" : "gelée"}`);
  }

  // Garage inscrit mais jamais abonné. DÉCISION DE PHASE PILOTE du
  // 2026-09-12 : il garde un accès complet et sans limite de durée — voir
  // la note dans middleware.ts. Cette assertion n'est pas là parce que
  // c'est souhaitable à terme, mais pour que ce soit un choix écrit plutôt
  // qu'une valeur par défaut qu'on découvre un jour. Le jour où un essai
  // gratuit ou un paiement préalable sera introduit, elle échouera : c'est
  // voulu, il faudra alors la réécrire en même temps que la décision.
  await etatGarage({ statut: "actif", abonnement_statut: null });
  const sansAbonnement = await sonderEtat("sans abonnement");
  verifier("cycle de vie", "sans abonnement — la décision de phase pilote a changé (voir middleware.ts)",
    sansAbonnement.litEncore && sansAbonnement.ecritEncore,
    `lecture ${sansAbonnement.litEncore}, écriture ${sansAbonnement.ecritEncore}`);
  console.log(`  ${"sans abonnement (pilote)".padEnd(30)} lecture ${sansAbonnement.litEncore ? "ok" : "PERDUE"}   écriture ${sansAbonnement.ecritEncore ? "ouverte, par décision" : "GELÉE — décision changée ?"}`);

  // Et le retour. Une suspension qu'on ne sait pas lever est une panne,
  // pas un levier — c'est l'autre moitié, celle qu'on oublie.
  await etatGarage({ statut: "actif", abonnement_statut: "active" });
  const retabli = await sonderEtat("rétabli");
  verifier("cycle de vie", "rétabli — le garage ne réécrit pas", retabli.ecritEncore, `statut ${retabli.statut}`);
  console.log(`  ${"rétabli".padEnd(30)} lecture ${retabli.litEncore ? "ok" : "PERDUE"}   écriture ${retabli.ecritEncore ? "rendue" : "TOUJOURS GELÉE"}`);

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
