import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/dates";
import { envoyerCourriel } from "@/lib/courriel";

const LABEL_ETAT: Record<string, string> = {
  neuve: "Neuve",
  usagee: "Usagée",
  reusinee: "Réusinée",
  remise_a_neuf: "Remise à neuf",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

// Même précaution que envoyer-facture : tout texte saisi par le
// personnel doit être échappé avant d'entrer dans le HTML du courriel.
function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Envoyer le devis (évaluation écrite) au client sert de preuve qu'il a
// confirmé le prix avant les travaux — même infrastructure d'envoi que
// envoyer-facture, réservée admin/reception pour la même raison.
export async function POST(request: NextRequest) {
  const { bonTravailId } = await request.json();
  if (!bonTravailId) {
    return NextResponse.json({ error: "Bon de travail manquant." }, { status: 400 });
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const { data: profil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profil || !["admin", "reception"].includes(profil.role)) {
    return NextResponse.json({ error: "Seuls la réception et l'administrateur peuvent envoyer un devis par courriel." }, { status: 403 });
  }

  const { data: bon } = await supabase.from("bons_travail").select("*").eq("id", bonTravailId).single();
  if (!bon) {
    return NextResponse.json({ error: "Bon de travail introuvable." }, { status: 404 });
  }
  if (bon.montant_evaluation == null && !bon.renonciation_ecrite) {
    return NextResponse.json({ error: "Aucune évaluation acceptée à envoyer pour ce bon de travail." }, { status: 400 });
  }

  const [{ data: client }, { data: vehicule }, { data: lignes }, { data: garage }] = await Promise.all([
    bon.client_id ? supabase.from("clients").select("*").eq("id", bon.client_id).single() : Promise.resolve({ data: null }),
    bon.vehicule_id
      ? supabase.from("vehicules").select("*").eq("id", bon.vehicule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("bon_travail_lignes").select("*").eq("bon_travail_id", bonTravailId).order("ordre"),
    supabase.from("parametres").select("*").single(),
  ]);

  if (!client?.email) {
    return NextResponse.json({ error: "Ce client n'a pas d'adresse courriel enregistrée." }, { status: 400 });
  }

  const nomGarage = garage?.nom ?? "MECAFORCE";
  const html = construireHtml({ bon, client, vehicule, lignes: lignes ?? [], garage, nomGarage });

  const envoi = await envoyerCourriel({
    destinataire: client.email,
    nomExpediteur: nomGarage,
    sujet: `Devis ${bon.numero} — ${nomGarage}`,
    html,
  });
  if (!envoi.ok) {
    return NextResponse.json({ error: envoi.erreur }, { status: envoi.statut });
  }

  await supabase
    .from("bons_travail")
    .update({ evaluation_envoyee_le: new Date().toISOString(), evaluation_envoyee_a: client.email })
    .eq("id", bonTravailId);

  return NextResponse.json({ ok: true, envoyeeA: client.email });
}

function construireHtml({
  bon,
  client,
  vehicule,
  lignes,
  garage,
  nomGarage,
}: {
  bon: any;
  client: any;
  vehicule: any;
  lignes: any[];
  garage: any;
  nomGarage: string;
}) {
  const piecesLignes = lignes.filter((l) => l.type === "piece");
  const mainOeuvreLignes = lignes.filter((l) => l.type === "main_oeuvre");
  const totalHt = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const ligneHtml = (l: any) => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${echapperHtml(l.description)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;">${
        l.type === "piece" ? LABEL_ETAT[l.etat_piece ?? ""] ?? "" : "Main-d'œuvre"
      }</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${l.quantite}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatMoney(l.prix_unitaire)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right;">${formatMoney(l.quantite * l.prix_unitaire)}</td>
    </tr>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <div style="border-bottom:2px solid #0B5BE8;padding-bottom:12px;margin-bottom:20px;">
      <img src="https://mecaforce-site.vercel.app/logo-fond-clair.png" alt="${echapperHtml(nomGarage)}" width="220" height="32" style="display:block;margin-bottom:16px;" />
      ${garage?.adresse ? `<div style="color:#555;font-size:13px;">${echapperHtml(garage.adresse)}</div>` : ""}
      ${garage?.telephone ? `<div style="color:#555;font-size:13px;">${echapperHtml(garage.telephone)}</div>` : ""}
    </div>

    <p>Bonjour ${echapperHtml(client?.nom)},</p>
    <p>Voici le devis <b>${echapperHtml(bon.numero)}</b> pour les travaux à effectuer sur votre véhicule, confirmant le prix accepté.</p>

    ${
      vehicule
        ? `<p style="color:#555;font-size:13px;">Véhicule : ${echapperHtml(vehicule.marque)} ${echapperHtml(vehicule.modele)} ${vehicule.annee ? `(${Number(vehicule.annee)})` : ""}</p>`
        : ""
    }

    <p style="color:#555;font-size:13px;">Plainte du client : ${echapperHtml(bon.plainte_client)}</p>
    ${bon.diagnostic ? `<p style="color:#555;font-size:13px;">Diagnostic : ${echapperHtml(bon.diagnostic)}</p>` : ""}

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0;">
      <thead>
        <tr style="text-align:left;color:#555;text-transform:uppercase;font-size:11px;">
          <th style="padding:6px 8px;border-bottom:2px solid #ccc;">Description</th>
          <th style="padding:6px 8px;border-bottom:2px solid #ccc;">État / type</th>
          <th style="padding:6px 8px;border-bottom:2px solid #ccc;text-align:right;">Qté</th>
          <th style="padding:6px 8px;border-bottom:2px solid #ccc;text-align:right;">Prix</th>
          <th style="padding:6px 8px;border-bottom:2px solid #ccc;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${piecesLignes.map(ligneHtml).join("")}
        ${mainOeuvreLignes.map(ligneHtml).join("")}
      </tbody>
    </table>

    <table style="width:260px;margin-left:auto;font-size:13px;">
      <tr><td style="padding:6px 0;font-weight:bold;border-top:1px solid #ccc;">Prix total (avant taxes)</td><td style="padding:6px 0;text-align:right;font-weight:bold;border-top:1px solid #ccc;">${formatMoney(totalHt)}</td></tr>
    </table>

    ${
      bon.evaluation_valide_jusqu_au
        ? `<p style="margin-top:16px;color:#555;font-size:13px;">Devis valide jusqu'au ${formatDateLong(bon.evaluation_valide_jusqu_au)}.</p>`
        : ""
    }

    <p style="margin-top:16px;color:#555;font-size:13px;">
      Une fois accepté, ce devis lie ${echapperHtml(nomGarage)} au prix indiqué — aucun dépassement sans nouvelle
      évaluation acceptée par vous.
    </p>

    <p style="margin-top:24px;">Merci de votre confiance,<br>${echapperHtml(nomGarage)}</p>
  </div>`;
}
