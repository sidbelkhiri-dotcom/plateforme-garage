// ============================================================
// Suite de conformité : ce qui engage le garage devant son client.
//
// Les suites d'isolation et d'inspection éprouvent la sécurité : qui peut
// voir et toucher quoi. Celle-ci éprouve autre chose — les règles que le
// garage PROMET à son client, et que le logiciel doit tenir même quand
// quelqu'un, dans le garage, voudrait les contourner :
//
//   - l'évaluation acceptée fige un prix : pas de dépassement sans nouvelle
//     évaluation acceptée (c'est écrit sur le document que signe le client) ;
//   - aucun travail sans évaluation acceptée ou renonciation écrite ;
//   - une facture émise ne change plus : ni montant, ni numéro, ni lignes,
//     et elle ne disparaît pas — une correction passe par une annulation ;
//   - les taxes sont calculées au cent près et figées sur la facture ;
//   - la numérotation des factures est continue ;
//   - un paiement ne dépasse pas le dû et ne s'applique pas à une facture
//     annulée.
//
// Ces règles sont celles que le projet s'est données (voir les commentaires
// de accepter_evaluation(), de la page d'évaluation imprimable et de
// proteger_montants_facture()). La suite ne cite aucun article de loi : elle
// vérifie que le logiciel fait ce qu'il dit.
//
// L'acteur est l'ADMIN du garage — le rôle qui a le plus de droits, donc le
// seul pour qui une règle tient vraiment si elle tient pour lui. Tout passe
// par l'API avec sa session, exactement comme l'application.
//
// Utilisation :  npm run conformite
// Nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local.
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
  // fichier absent : message d'erreur plus bas
}
const URL_SUPABASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SUPABASE || !ANON || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY dans .env.local.");
  process.exit(1);
}

const admin = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const marque = `conf-${Date.now()}`;
const aujourdhui = new Date().toISOString().slice(0, 10);

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
const lire = (table, filtre) => srv(`${table}?${filtre}`).then((r) => r[0]);

let session = null;
async function api(chemin, options = {}) {
  const r = await fetch(`${URL_SUPABASE}/rest/v1/${chemin}`, {
    ...options,
    headers: { ...session, Prefer: "return=representation", ...(options.headers ?? {}) },
  });
  const texte = await r.text();
  let corps = null;
  try { corps = texte ? JSON.parse(texte) : null; } catch { corps = texte; }
  return { statut: r.status, corps, ok: r.ok };
}
const rpc = (fonction, args) => api(`rpc/${fonction}`, { method: "POST", body: JSON.stringify(args) });
// Une modification « est passée » si la requête réussit ET touche au moins
// une ligne : PostgREST répond 200 avec [] quand la RLS masque la ligne.
const aModifie = (r) => r.ok && Array.isArray(r.corps) && r.corps.length > 0;

const echecs = [];
function verifier(regle, tenue, detail = "") {
  if (!tenue) echecs.push(`${regle}${detail ? " : " + detail : ""}`);
  console.log(`  ${tenue ? "ok     " : "ÉCHEC  "}${regle}${tenue || !detail ? "" : "  — " + detail}`);
  return tenue;
}

// ------------------------------------------------------------
const aNettoyer = { garage: null, utilisateur: null };

async function nettoyer() {
  if (aNettoyer.utilisateur) {
    await fetch(`${URL_SUPABASE}/auth/v1/admin/users/${aNettoyer.utilisateur}`, { method: "DELETE", headers: admin }).catch(() => {});
  }
  if (!aNettoyer.garage) return;
  const g = aNettoyer.garage;
  for (const table of [
    "facture_lignes", "factures", "bon_travail_evaluations", "bon_travail_lignes",
    "bons_travail", "rendez_vous", "vehicules", "clients", "demandes_accueil", "parametres",
  ]) {
    await fetch(`${URL_SUPABASE}/rest/v1/${table}?garage_id=eq.${g}`, { method: "DELETE", headers: admin }).catch(() => {});
  }
  await fetch(`${URL_SUPABASE}/rest/v1/garages?id=eq.${g}`, { method: "DELETE", headers: admin }).catch(() => {});
}

// Un bon dont les lignes totalisent `montant`, prêt pour le parcours légal.
async function nouveauBon(client, vehicule, montant, description) {
  const bon = await creer("bons_travail", {
    garage_id: aNettoyer.garage, client_id: client.id, vehicule_id: vehicule.id,
    kilometrage: 50000, plainte_client: `${marque} ${description}`, taux_horaire: 100, ouvert_le: aujourdhui,
  });
  await creer("bon_travail_lignes", {
    bon_travail_id: bon.id, type: "piece", description: `${marque} pièce`, quantite: 1,
    prix_unitaire: montant, etat_piece: "neuve",
  });
  return bon;
}

async function totalBon(bonId) {
  return Number((await lire("bons_travail_totaux", `select=total_ht&id=eq.${bonId}`)).total_ht);
}

// Accepté, démarré, terminé : l'état où l'on facture.
async function amenerATermine(bonId) {
  const total = await totalBon(bonId);
  const acceptation = await rpc("accepter_evaluation", { bon_id: bonId, p_montant_attendu: total });
  if (!acceptation.ok) throw new Error(`acceptation : ${JSON.stringify(acceptation.corps)}`);
  for (const statut of ["en_cours", "termine"]) {
    const r = await api(`bons_travail?id=eq.${bonId}`, { method: "PATCH", body: JSON.stringify({ statut }) });
    if (!aModifie(r)) throw new Error(`passage à ${statut} : ${r.statut} ${JSON.stringify(r.corps)}`);
  }
}

try {
  console.log("Mise en place d'un garage, de son admin et de son parcours de facturation…\n");

  const garage = await creer("garages", { nom: `${marque} garage`, statut: "actif" });
  aNettoyer.garage = garage.id;
  await creer("parametres", {
    garage_id: garage.id, nom: `${marque} garage`, taux_horaire: 100,
    validite_evaluation_jours: 30, taux_tps: 0.05, taux_tvq: 0.09975,
  });

  const courriel = `${marque}@example.com`;
  const motDePasse = `Conf${Date.now()}!`;
  const u = await fetch(`${URL_SUPABASE}/auth/v1/admin/users`, {
    method: "POST", headers: admin, body: JSON.stringify({ email: courriel, password: motDePasse, email_confirm: true }),
  }).then((r) => r.json());
  aNettoyer.utilisateur = u.id;
  // Voir scripts/isolation.mjs : un PATCH de rôle est annulé en silence par
  // protect_profile_role() ; on remplace la ligne.
  await srv(`profiles?id=eq.${u.id}`, { method: "DELETE" });
  await creer("profiles", { id: u.id, nom: courriel, garage_id: garage.id, role: "admin", actif: true });
  const s = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: courriel, password: motDePasse }),
  }).then((r) => r.json());
  session = { apikey: ANON, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" };

  const client = await creer("clients", { garage_id: garage.id, nom: `${marque} client` });
  const vehicule = await creer("vehicules", { garage_id: garage.id, client_id: client.id, marque: "Testo", modele: "Conf" });

  // ------------------------------------------------------------
  console.log("1. Aucun travail ni facture sans évaluation acceptée");
  // ------------------------------------------------------------
  const bonSansEvaluation = await nouveauBon(client, vehicule, 100, "sans évaluation");
  const demarrageSauvage = await api(`bons_travail?id=eq.${bonSansEvaluation.id}`, {
    method: "PATCH", body: JSON.stringify({ statut: "en_cours" }),
  });
  verifier("un bon jamais évalué ne peut pas passer « en cours »", !aModifie(demarrageSauvage),
    `passé en cours sans évaluation acceptée ni renonciation`);
  if (aModifie(demarrageSauvage)) {
    await api(`bons_travail?id=eq.${bonSansEvaluation.id}`, { method: "PATCH", body: JSON.stringify({ statut: "termine" }) });
  }
  const factureSansEvaluation = await rpc("creer_facture", { bon_id: bonSansEvaluation.id, p_date: aujourdhui });
  verifier("un bon jamais évalué ne peut pas être facturé", !factureSansEvaluation.ok,
    "facture créée pour des travaux jamais estimés au client");

  // ------------------------------------------------------------
  console.log("\n2. L'évaluation acceptée fige le prix");
  // ------------------------------------------------------------
  const bonFige = await nouveauBon(client, vehicule, 300, "prix figé");
  const totalAccepte = await totalBon(bonFige.id);
  await rpc("accepter_evaluation", { bon_id: bonFige.id, p_montant_attendu: totalAccepte });

  const retouche = await api(`bons_travail?id=eq.${bonFige.id}`, {
    method: "PATCH", body: JSON.stringify({ montant_evaluation: totalAccepte + 500 }),
  });
  const apresRetouche = Number((await lire("bons_travail", `select=montant_evaluation&id=eq.${bonFige.id}`)).montant_evaluation);
  verifier("le montant accepté par le client ne se modifie pas directement",
    apresRetouche === totalAccepte, `passé de ${totalAccepte} à ${apresRetouche} $ sans nouvelle acceptation`);
  if (apresRetouche !== totalAccepte) {
    // La clé service n'a pas de rôle aux yeux de proteger_autorisation_bon() ;
    // l'admin, lui, passe — c'est précisément la faille constatée.
    await api(`bons_travail?id=eq.${bonFige.id}`, { method: "PATCH", body: JSON.stringify({ montant_evaluation: totalAccepte }) });
  }

  const historique = await lire("bon_travail_evaluations", `select=id,montant&bon_travail_id=eq.${bonFige.id}`);
  const retoucheHistorique = await api(`bon_travail_evaluations?id=eq.${historique.id}`, {
    method: "PATCH", body: JSON.stringify({ montant: totalAccepte + 500 }),
  });
  verifier("la trace d'une acceptation ne se modifie pas", !aModifie(retoucheHistorique),
    "montant de l'acceptation réécrit dans l'historique");
  const effacementHistorique = await api(`bon_travail_evaluations?id=eq.${historique.id}`, { method: "DELETE" });
  verifier("la trace d'une acceptation ne s'efface pas", !aModifie(effacementHistorique),
    "acceptation supprimée de l'historique");

  // Dépassement : on ajoute des travaux après l'acceptation, sans réévaluer.
  await api("bon_travail_lignes", {
    method: "POST",
    body: JSON.stringify({ bon_travail_id: bonFige.id, type: "main_oeuvre", description: `${marque} ajout`, quantite: 2, prix_unitaire: 100 }),
  });
  for (const statut of ["en_cours", "termine"]) {
    await api(`bons_travail?id=eq.${bonFige.id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
  }
  const totalFinal = await totalBon(bonFige.id);
  const factureDepassement = await rpc("creer_facture", { bon_id: bonFige.id, p_date: aujourdhui });
  verifier("pas de facture au-dessus du prix accepté sans nouvelle évaluation", !factureDepassement.ok,
    `facturé ${totalFinal} $ pour une évaluation acceptée à ${totalAccepte} $`);

  if (!factureDepassement.ok) {
    // Témoin : le refus doit avoir une issue. Le client accepte le nouveau
    // montant au comptoir, et la facture passe.
    const reevaluation = await rpc("reevaluer_bon", { bon_id: bonFige.id, p_montant_attendu: totalFinal });
    const factureApres = reevaluation.ok ? await rpc("creer_facture", { bon_id: bonFige.id, p_date: aujourdhui }) : reevaluation;
    verifier("(témoin) après réévaluation acceptée, le bon terminé se facture", factureApres.ok,
      JSON.stringify(factureApres.corps).slice(0, 160));
  }

  const bonPreAutorise = await api("bons_travail", {
    method: "POST",
    body: JSON.stringify({
      garage_id: garage.id, client_id: client.id, vehicule_id: vehicule.id, kilometrage: 1, plainte_client: `${marque} pré-autorisé`, taux_horaire: 100, ouvert_le: aujourdhui,
      statut: "autorise", montant_evaluation: 9999, evaluation_acceptee_le: new Date().toISOString(),
    }),
  });
  // Refus attendu du déclencheur (P0001), pas d'une colonne obligatoire
  // oubliée : la première version de cette sonde « passait » pour ça.
  verifier("un bon ne se crée pas déjà « autorisé »", !bonPreAutorise.ok && bonPreAutorise.corps?.code === "P0001",
    bonPreAutorise.ok ? "bon créé avec une acceptation fabriquée" : `refusé pour une autre raison : ${bonPreAutorise.corps?.message}`);

  // Témoin : la renonciation écrite reste un chemin légal complet.
  const bonRenonce = await nouveauBon(client, vehicule, 80, "renonciation");
  const renonciation = await rpc("renoncer_evaluation", { bon_id: bonRenonce.id });
  let factureRenonce = renonciation;
  if (renonciation.ok) {
    for (const statut of ["en_cours", "termine"]) {
      await api(`bons_travail?id=eq.${bonRenonce.id}`, { method: "PATCH", body: JSON.stringify({ statut }) });
    }
    factureRenonce = await rpc("creer_facture", { bon_id: bonRenonce.id, p_date: aujourdhui });
  }
  verifier("(témoin) un bon avec renonciation écrite se travaille et se facture", factureRenonce.ok,
    JSON.stringify(factureRenonce.corps).slice(0, 160));

  // ------------------------------------------------------------
  console.log("\n3. Taxes calculées au cent près et figées sur la facture");
  // ------------------------------------------------------------
  // 20,70 $ : 20,70 × 5 % = 1,035 — le cas où un arrondi flottant naïf se trompe.
  const bonTaxes = await nouveauBon(client, vehicule, 20.7, "taxes");
  await amenerATermine(bonTaxes.id);
  const creation = await rpc("creer_facture", { bon_id: bonTaxes.id, p_date: aujourdhui });
  if (!creation.ok) throw new Error(`facturation de référence impossible : ${JSON.stringify(creation.corps)}`);
  const factureId = creation.corps;
  const f = await lire("factures", `select=*&id=eq.${factureId}`);
  verifier("TPS arrondie au cent près (20,70 × 5 % = 1,04)", Number(f.montant_tps) === 1.04, `TPS ${f.montant_tps}`);
  verifier("TVQ arrondie au cent près (20,70 × 9,975 % = 2,06)", Number(f.montant_tvq) === 2.06, `TVQ ${f.montant_tvq}`);
  verifier("total = avant taxes + TPS + TVQ", Number(f.total_ttc) === 23.8, `total ${f.total_ttc}`);

  await srv(`parametres?garage_id=eq.${garage.id}`, { method: "PATCH", body: JSON.stringify({ taux_tps: 0.07 }) });
  const fApresTaux = await lire("factures", `select=taux_tps,montant_tps,total_ttc&id=eq.${factureId}`);
  verifier("changer le taux du garage ne touche pas une facture émise",
    Number(fApresTaux.taux_tps) === 0.05 && Number(fApresTaux.total_ttc) === 23.8,
    `taux ${fApresTaux.taux_tps}, total ${fApresTaux.total_ttc}`);
  await srv(`parametres?garage_id=eq.${garage.id}`, { method: "PATCH", body: JSON.stringify({ taux_tps: 0.05 }) });

  // ------------------------------------------------------------
  console.log("\n4. Une facture émise ne change plus");
  // ------------------------------------------------------------
  const tentatives = [
    ["le total", { total_ttc: 1 }],
    ["le numéro", { numero: "FA-9999" }],
    ["l'exemption de taxes", { sans_taxe: true }],
    ["la date", { date: "2020-01-01" }],
  ];
  for (const [quoi, donnees] of tentatives) {
    const r = await api(`factures?id=eq.${factureId}`, { method: "PATCH", body: JSON.stringify(donnees) });
    verifier(`${quoi} d'une facture émise ne se modifie pas`, !aModifie(r), `modification acceptée (${JSON.stringify(donnees)})`);
  }
  const fApres = await lire("factures", `select=numero,total_ttc,sans_taxe&id=eq.${factureId}`);
  if (fApres.numero !== f.numero || Number(fApres.total_ttc) !== Number(f.total_ttc) || fApres.sans_taxe !== f.sans_taxe) {
    console.log(`         (la facture a réellement changé : ${f.numero} → ${fApres.numero})`);
    await srv(`factures?id=eq.${factureId}`, { method: "PATCH", body: JSON.stringify({ numero: f.numero }) }).catch(() => {});
  }

  const ligne = await lire("facture_lignes", `select=id,prix_unitaire&facture_id=eq.${factureId}`);
  const retoucheLigne = await api(`facture_lignes?id=eq.${ligne.id}`, { method: "PATCH", body: JSON.stringify({ prix_unitaire: 1 }) });
  verifier("une ligne de facture émise ne se modifie pas", !aModifie(retoucheLigne), "prix d'une ligne réécrit");
  const ajoutLigne = await api("facture_lignes", {
    method: "POST",
    body: JSON.stringify({ facture_id: factureId, type: "piece", description: "ajout après émission", quantite: 1, prix_unitaire: 50, etat_piece: "neuve" }),
  });
  verifier("on n'ajoute pas de ligne à une facture émise", !ajoutLigne.ok, "ligne ajoutée après émission");
  const retraitLigne = await api(`facture_lignes?id=eq.${ligne.id}`, { method: "DELETE" });
  verifier("on ne retire pas de ligne d'une facture émise", !aModifie(retraitLigne), "ligne supprimée après émission");

  const suppression = await api(`factures?id=eq.${factureId}`, { method: "DELETE" });
  verifier("une facture émise ne disparaît pas", !aModifie(suppression), "facture supprimée — trou dans la numérotation");

  // ------------------------------------------------------------
  console.log("\n5. Numérotation continue");
  // ------------------------------------------------------------
  const tentativeRatee = await rpc("creer_facture", { bon_id: bonSansEvaluation.id, p_date: aujourdhui });
  const bonSuivant = await nouveauBon(client, vehicule, 40, "numérotation");
  await amenerATermine(bonSuivant.id);
  const suivante = await rpc("creer_facture", { bon_id: bonSuivant.id, p_date: aujourdhui });
  const numeros = (await srv(`factures?select=numero&garage_id=eq.${garage.id}&order=numero`)).map((x) => x.numero);
  const continus = numeros.every((n, i) => Number(n.replace("FA-", "")) === i + 1);
  verifier("les numéros de facture se suivent sans trou", suivante.ok && continus,
    `numéros : ${numeros.join(", ")}${tentativeRatee.ok ? " (une facture a été créée là où elle aurait dû être refusée)" : ""}`);

  // ------------------------------------------------------------
  console.log("\n6. Paiements");
  // ------------------------------------------------------------
  const surpaiement = await rpc("enregistrer_paiement", { p_facture_id: factureId, p_montant: 1000 });
  const fPayee = await lire("factures", `select=montant_paye,total_ttc,statut&id=eq.${factureId}`);
  verifier("un paiement ne dépasse pas le dû", surpaiement.ok && Number(fPayee.montant_paye) === Number(fPayee.total_ttc),
    `payé ${fPayee.montant_paye} sur ${fPayee.total_ttc}`);
  verifier("une facture entièrement payée passe à « payée »", fPayee.statut === "payee", `statut ${fPayee.statut}`);

  const suivanteId = suivante.corps;
  const annulation = await rpc("annuler_facture", { facture_id: suivanteId, motif: "erreur de saisie" });
  if (!annulation.ok) {
    console.log(`         (annulation impossible avec ces arguments : ${JSON.stringify(annulation.corps).slice(0, 140)})`);
  } else {
    const paiementAnnulee = await rpc("enregistrer_paiement", { p_facture_id: suivanteId, p_montant: 10 });
    verifier("on n'encaisse pas sur une facture annulée", !paiementAnnulee.ok, "paiement accepté sur une facture annulée");
  }

  // ------------------------------------------------------------
  console.log("\n7. Renseignements personnels (Loi 25)");
  // ------------------------------------------------------------
  const clientPrive = await creer("clients", {
    garage_id: garage.id, nom: `${marque} Julie Roy`, telephone: "5145550123", email: "julie@example.com", adresse: "1 rue Test",
  });
  const vehiculePrive = await creer("vehicules", {
    garage_id: garage.id, client_id: clientPrive.id, marque: "Testo", modele: "Privé", plaque: "LOI025", vin: "1HGBH41JXMN109186",
  });
  const bonPrive = await creer("bons_travail", {
    garage_id: garage.id, client_id: clientPrive.id, vehicule_id: vehiculePrive.id,
    kilometrage: 1, plainte_client: `${marque} privé`, taux_horaire: 100, ouvert_le: aujourdhui,
  });
  await creer("bon_travail_lignes", { bon_travail_id: bonPrive.id, type: "piece", description: `${marque} pièce`, quantite: 1, prix_unitaire: 50, etat_piece: "neuve" });
  await amenerATermine(bonPrive.id);
  const facturePrivee = await rpc("creer_facture", { bon_id: bonPrive.id, p_date: aujourdhui });
  const idFacturePrivee = facturePrivee.corps;
  const identiteEmise = await lire("factures", `select=client_nom,client_telephone,vehicule_plaque&id=eq.${idFacturePrivee}`);
  verifier("la facture fige l'identité de l'acheteur à l'émission",
    identiteEmise?.client_nom === `${marque} Julie Roy` && identiteEmise?.vehicule_plaque === "LOI025",
    JSON.stringify(identiteEmise));

  await api(`clients?id=eq.${clientPrive.id}`, { method: "PATCH", body: JSON.stringify({ nom: `${marque} Julie Roy-Tremblay` }) });
  const apresRenommage = await lire("factures", `select=client_nom&id=eq.${idFacturePrivee}`);
  verifier("renommer un client ne réécrit pas ses factures passées",
    apresRenommage?.client_nom === `${marque} Julie Roy`, `facture : « ${apresRenommage?.client_nom} »`);

  const retoucheIdentite = await api(`factures?id=eq.${idFacturePrivee}`, { method: "PATCH", body: JSON.stringify({ client_nom: "Autre" }) });
  verifier("l'identité figée d'une facture ne se modifie pas", !aModifie(retoucheIdentite), "client_nom réécrit");

  // Consentement : daté par la base, jamais antidaté à la main.
  await api(`clients?id=eq.${clientPrive.id}`, { method: "PATCH", body: JSON.stringify({ consentement_communications: true }) });
  const consenti = await lire("clients", `select=consentement_communications_le&id=eq.${clientPrive.id}`);
  verifier("cocher le consentement le date", Boolean(consenti?.consentement_communications_le), "date absente");
  await api(`clients?id=eq.${clientPrive.id}`, { method: "PATCH", body: JSON.stringify({ consentement_communications_le: "2020-01-01T00:00:00Z" }) });
  const antidate = await lire("clients", `select=consentement_communications_le&id=eq.${clientPrive.id}`);
  verifier("la date du consentement ne s'antidate pas",
    antidate?.consentement_communications_le === consenti?.consentement_communications_le, `obtenue ${antidate?.consentement_communications_le}`);

  // Portabilité : une copie structurée de tout le dossier.
  const exportClient = await rpc("exporter_client", { p_client_id: clientPrive.id });
  verifier("l'export d'un client contient sa fiche, ses véhicules et ses factures",
    exportClient.ok && exportClient.corps?.client?.telephone === "5145550123"
      && exportClient.corps?.vehicules?.length === 1 && exportClient.corps?.factures?.length === 1,
    `statut ${exportClient.statut} ${JSON.stringify(exportClient.corps).slice(0, 140)}`);

  // Effacement : la fiche perd l'identité, la facture la garde.
  const effacement = await rpc("anonymiser_client", { p_client_id: clientPrive.id });
  const ficheEffacee = await lire("clients", `select=nom,telephone,email,adresse,consentement_communications&id=eq.${clientPrive.id}`);
  const vehiculeEfface = await lire("vehicules", `select=plaque,vin&id=eq.${vehiculePrive.id}`);
  verifier("l'anonymisation efface nom, coordonnées, plaque et NIV",
    effacement.ok && ficheEffacee?.nom === "Client anonymisé" && !ficheEffacee?.telephone && !ficheEffacee?.email
      && !ficheEffacee?.consentement_communications && !vehiculeEfface?.plaque && !vehiculeEfface?.vin,
    `statut ${effacement.statut} ${JSON.stringify({ ficheEffacee, vehiculeEfface })}`);
  const factureConservee = await lire("factures", `select=client_nom,vehicule_plaque,total_ttc&id=eq.${idFacturePrivee}`);
  verifier("la facture d'un client anonymisé reste une pièce comptable complète",
    factureConservee?.client_nom === `${marque} Julie Roy` && factureConservee?.vehicule_plaque === "LOI025",
    JSON.stringify(factureConservee));

  const purgeParEmploye = await rpc("purger_demandes_publiques", {});
  verifier("un compte du garage ne peut pas déclencher la purge de toutes les demandes", !purgeParEmploye.ok,
    `statut ${purgeParEmploye.statut}`);

  // La purge efface ce qui a fait son temps, et seulement ça.
  const ancienne = await creer("demandes_accueil", { garage_id: garage.id, nom: `${marque} ancienne`, statut: "traitee" });
  const recente = await creer("demandes_accueil", { garage_id: garage.id, nom: `${marque} récente`, statut: "traitee" });
  await srv(`demandes_accueil?id=eq.${ancienne.id}`, {
    method: "PATCH", body: JSON.stringify({ created_at: new Date(Date.now() - 100 * 86400000).toISOString() }),
  });
  await srv("rpc/purger_demandes_publiques", { method: "POST", body: "{}" });
  const restantes = (await srv(`demandes_accueil?select=id&garage_id=eq.${garage.id}`)).map((d) => d.id);
  verifier("la purge efface une demande traitée de plus de 90 jours et garde la récente",
    !restantes.includes(ancienne.id) && restantes.includes(recente.id), `restantes : ${restantes.length}`);

  await nettoyer();
  console.log("\n" + "-".repeat(72));
  if (echecs.length) {
    console.log(`${echecs.length} RÈGLE(S) NON TENUE(S) :`);
    echecs.forEach((e) => console.log("  - " + e));
    process.exit(1);
  }
  console.log("Chaque engagement pris devant le client tient, même face à l'admin du garage.");
} catch (erreur) {
  await nettoyer();
  console.error("\nLa suite n'a pas pu aller au bout :", erreur.message);
  process.exit(1);
}
