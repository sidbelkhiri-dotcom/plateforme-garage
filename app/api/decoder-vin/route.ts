import { NextRequest, NextResponse } from "next/server";

// NHTSA vPIC (National Highway Traffic Safety Administration) : décodeur
// de NIV gratuit, sans clé, opéré par le gouvernement américain. Couvre
// aussi les véhicules vendus au Canada — les NIV suivent la même norme
// nord-américaine (ISO 3779) quel que soit le marché de vente.
// Documentation : https://vpic.nhtsa.dot.gov/api/
const NHTSA_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/decodevin";

type ResultatNhtsa = { Results: Array<{ Variable: string; Value: string | null }> };

function valeur(resultats: ResultatNhtsa["Results"], nom: string): string | null {
  const v = resultats.find((r) => r.Variable === nom)?.Value;
  return v && v !== "Not Applicable" ? v : null;
}

export async function POST(request: NextRequest) {
  const { vin } = await request.json();
  const nivPropre = String(vin ?? "").trim().toUpperCase();

  if (nivPropre.length !== 17) {
    return NextResponse.json({ error: "Un NIV valide comporte 17 caractères." }, { status: 400 });
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${NHTSA_URL}/${encodeURIComponent(nivPropre)}?format=json`, {
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "Le service de décodage ne répond pas. Réessayez." }, { status: 502 });
  }

  if (!reponse.ok) {
    return NextResponse.json({ error: "Le service de décodage ne répond pas. Réessayez." }, { status: 502 });
  }

  const donnees = (await reponse.json()) as ResultatNhtsa;
  const marque = valeur(donnees.Results, "Make");
  const modele = valeur(donnees.Results, "Model");
  const annee = valeur(donnees.Results, "Model Year");

  if (!marque) {
    return NextResponse.json({ error: "Ce NIV n'a pas pu être décodé — vérifiez qu'il est correct." }, { status: 422 });
  }

  return NextResponse.json({
    marque,
    modele,
    annee,
    // Renseignements secondaires, affichés seulement s'ils existent —
    // utiles pour confirmer visuellement que le bon véhicule a été trouvé.
    carrosserie: valeur(donnees.Results, "Body Class"),
    cylindres: valeur(donnees.Results, "Engine Number of Cylinders"),
  });
}
