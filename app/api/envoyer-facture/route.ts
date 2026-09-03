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

// Le HTML de ce courriel est construit par concaténation de chaînes —
// tout texte saisi par le personnel (description de pièce, nom de
// client...) doit être échappé avant d'y entrer, sinon un simple "<" ou
// "&" dans une description casse l'affichage chez le client.
function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// L'envoi lui-même passe par lib/courriel.ts (Resend) — la clé n'est
// jamais préfixée NEXT_PUBLIC_ et reste côté serveur.
export async function POST(request: NextRequest) {
  const { factureId } = await request.json();
  if (!factureId) {
    return NextResponse.json({ error: "Facture manquante." }, { status: 400 });
  }

  const supabase = createClient();

  // Même garde-fou que creer_facture()/annuler_facture() : réservé
  // admin/reception. La RLS bloquerait de toute façon la mise à jour de
  // envoyee_le/envoyee_a plus bas, mais ce contrôle explicite donne un
  // message clair plutôt qu'un échec silencieux.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const { data: profil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profil || !["admin", "reception"].includes(profil.role)) {
    return NextResponse.json({ error: "Seuls la réception et l'administrateur peuvent envoyer une facture par courriel." }, { status: 403 });
  }

  const { data: facture } = await supabase.from("factures").select("*").eq("id", factureId).single();
  if (!facture) {
    return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  }

  const [{ data: client }, { data: vehicule }, { data: lignes }, { data: garage }] = await Promise.all([
    facture.client_id ? supabase.from("clients").select("*").eq("id", facture.client_id).single() : Promise.resolve({ data: null }),
    facture.vehicule_id
      ? supabase.from("vehicules").select("*").eq("id", facture.vehicule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("facture_lignes").select("*").eq("facture_id", factureId).order("ordre"),
    supabase.from("parametres").select("*").single(),
  ]);

  if (!client?.email) {
    return NextResponse.json({ error: "Ce client n'a pas d'adresse courriel enregistrée." }, { status: 400 });
  }

  const nomGarage = garage?.nom ?? "Votre garage";
  const html = construireHtml({ facture, client, vehicule, lignes: lignes ?? [], garage, nomGarage });

  const envoi = await envoyerCourriel({
    destinataire: client.email,
    nomExpediteur: nomGarage,
    sujet: facture.sans_taxe
      ? `Reçu de paiement ${facture.numero} — ${nomGarage}`
      : `Facture ${facture.numero} — ${nomGarage}`,
    html,
  });
  if (!envoi.ok) {
    return NextResponse.json({ error: envoi.erreur }, { status: envoi.statut });
  }

  await supabase
    .from("factures")
    .update({ envoyee_le: new Date().toISOString(), envoyee_a: client.email })
    .eq("id", factureId);

  return NextResponse.json({ ok: true, envoyeeA: client.email });
}

function construireHtml({
  facture,
  client,
  vehicule,
  lignes,
  garage,
  nomGarage,
}: {
  facture: any;
  client: any;
  vehicule: any;
  lignes: any[];
  garage: any;
  nomGarage: string;
}) {
  const piecesLignes = lignes.filter((l) => l.type === "piece");
  const mainOeuvreLignes = lignes.filter((l) => l.type === "main_oeuvre");
  const solde = facture.total_ttc - facture.montant_paye;

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

  const ligneTaxes = facture.sans_taxe
    ? `<tr><td colspan="2" style="padding:2px 0;color:#555;">Sans taxe</td><td style="padding:2px 0;text-align:right;">${formatMoney(0)}</td></tr>`
    : `
    <tr><td colspan="2" style="padding:2px 0;color:#555;">TPS (${(facture.taux_tps * 100).toFixed(3)} %)</td><td style="padding:2px 0;text-align:right;">${formatMoney(facture.montant_tps)}</td></tr>
    <tr><td colspan="2" style="padding:2px 0;color:#555;">TVQ (${(facture.taux_tvq * 100).toFixed(3)} %)</td><td style="padding:2px 0;text-align:right;">${formatMoney(facture.montant_tvq)}</td></tr>`;

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <div style="border-bottom:2px solid #0B5BE8;padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:12px;">${echapperHtml(nomGarage)}</div>
      ${garage?.adresse ? `<div style="color:#555;font-size:13px;">${echapperHtml(garage.adresse)}</div>` : ""}
      ${garage?.telephone ? `<div style="color:#555;font-size:13px;">${echapperHtml(garage.telephone)}</div>` : ""}
      ${
        garage?.tps || garage?.tvq
          ? `<div style="color:#777;font-size:11px;margin-top:4px;">${
              garage?.tps ? `TPS : ${echapperHtml(garage.tps)} ` : ""
            }${garage?.tvq ? `· TVQ : ${echapperHtml(garage.tvq)}` : ""}</div>`
          : ""
      }
    </div>

    <p>Bonjour ${echapperHtml(client?.nom)},</p>
    <p>Voici votre ${facture.sans_taxe ? "reçu de paiement" : "facture"} <b>${echapperHtml(facture.numero)}</b> du ${formatDateLong(facture.date)}.</p>

    ${
      client?.adresse || client?.code_postal
        ? `<p style="color:#555;font-size:13px;">${[client?.adresse, client?.code_postal].filter(Boolean).map(echapperHtml).join(", ")}</p>`
        : ""
    }

    ${
      vehicule
        ? `<p style="color:#555;font-size:13px;">Véhicule : ${echapperHtml(vehicule.marque)} ${echapperHtml(vehicule.modele)} ${vehicule.annee ? `(${Number(vehicule.annee)})` : ""}${
            vehicule.plaque ? ` — Immatriculation : ${echapperHtml(vehicule.plaque)}` : ""
          }</p>`
        : ""
    }
    ${
      facture.kilometrage != null
        ? `<p style="color:#555;font-size:13px;margin-top:-8px;">Kilométrage : ${Number(facture.kilometrage).toLocaleString("fr-CA")} km</p>`
        : ""
    }

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
      <tr><td colspan="2" style="padding:2px 0;color:#555;">Total avant taxes</td><td style="padding:2px 0;text-align:right;">${formatMoney(facture.total_ht)}</td></tr>
      ${ligneTaxes}
      <tr><td colspan="2" style="padding:6px 0;font-weight:bold;border-top:1px solid #ccc;">Total</td><td style="padding:6px 0;text-align:right;font-weight:bold;border-top:1px solid #ccc;">${formatMoney(facture.total_ttc)}</td></tr>
      ${
        facture.montant_paye > 0
          ? `<tr><td colspan="2" style="padding:2px 0;color:#555;">Payé</td><td style="padding:2px 0;text-align:right;">${formatMoney(facture.montant_paye)}</td></tr>
             <tr><td colspan="2" style="padding:2px 0;font-weight:bold;">Solde</td><td style="padding:2px 0;text-align:right;font-weight:bold;">${formatMoney(solde)}</td></tr>`
          : ""
      }
    </table>

    <p style="margin-top:24px;color:#555;font-size:13px;">
      Pièces et main-d'œuvre garanties ${facture.garantie_mois} mois ou ${Number(facture.garantie_km).toLocaleString("fr-CA")} km, selon la première échéance atteinte.
    </p>

    <p style="margin-top:24px;">Merci de votre confiance,<br>${echapperHtml(nomGarage)}</p>
  </div>`;
}
