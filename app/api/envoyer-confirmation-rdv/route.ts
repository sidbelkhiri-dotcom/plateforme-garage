import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, formatTimeShort } from "@/lib/dates";
import { envoyerCourriel } from "@/lib/courriel";

// Le HTML de ce courriel est construit par concaténation de chaînes —
// même précaution que envoyer-facture/envoyer-evaluation : tout texte
// saisi par le personnel doit être échappé avant d'y entrer.
function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Confirmation envoyée au client à la création d'un rendez-vous — même
// infrastructure d'envoi que les factures/devis. Best-effort côté
// appelant : un client sans courriel ou une config manquante ne doit
// jamais empêcher la création du rendez-vous lui-même.
export async function POST(request: NextRequest) {
  const { rdvId } = await request.json();
  if (!rdvId) {
    return NextResponse.json({ error: "Rendez-vous manquant." }, { status: 400 });
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const { data: rdv } = await supabase.from("rendez_vous").select("*").eq("id", rdvId).single();
  if (!rdv) {
    return NextResponse.json({ error: "Rendez-vous introuvable." }, { status: 404 });
  }

  const [{ data: client }, { data: vehicule }, { data: garage }] = await Promise.all([
    rdv.client_id ? supabase.from("clients").select("nom, email").eq("id", rdv.client_id).single() : Promise.resolve({ data: null }),
    rdv.vehicule_id
      ? supabase.from("vehicules").select("marque, modele, annee").eq("id", rdv.vehicule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("parametres").select("*").eq("id", 1).single(),
  ]);

  if (!client?.email) {
    return NextResponse.json({ error: "Ce client n'a pas d'adresse courriel enregistrée." }, { status: 400 });
  }

  const nomGarage = garage?.nom ?? "MECAFORCE";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <div style="border-bottom:2px solid #0B5BE8;padding-bottom:12px;margin-bottom:20px;">
      <img src="https://mecaforce-site.vercel.app/logo-fond-clair.png" alt="${echapperHtml(nomGarage)}" width="220" height="32" style="display:block;margin-bottom:16px;" />
      ${garage?.adresse ? `<div style="color:#555;font-size:13px;">${echapperHtml(garage.adresse)}</div>` : ""}
      ${garage?.telephone ? `<div style="color:#555;font-size:13px;">${echapperHtml(garage.telephone)}</div>` : ""}
    </div>

    <p>Bonjour ${echapperHtml(client.nom)},</p>
    <p>Nous confirmons votre rendez-vous chez ${echapperHtml(nomGarage)} :</p>

    <table style="width:100%;font-size:14px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#555;width:140px;">Date</td><td style="padding:4px 0;font-weight:bold;">${formatDateLong(rdv.date)}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Heure</td><td style="padding:4px 0;font-weight:bold;">${formatTimeShort(rdv.heure)}</td></tr>
      <tr><td style="padding:4px 0;color:#555;">Motif</td><td style="padding:4px 0;">${echapperHtml(rdv.description)}</td></tr>
      ${
        vehicule
          ? `<tr><td style="padding:4px 0;color:#555;">Véhicule</td><td style="padding:4px 0;">${echapperHtml(vehicule.marque)} ${echapperHtml(vehicule.modele)} ${vehicule.annee ? `(${Number(vehicule.annee)})` : ""}</td></tr>`
          : ""
      }
      <tr><td style="padding:4px 0;color:#555;">Durée estimée</td><td style="padding:4px 0;">${rdv.duree_min} minutes</td></tr>
    </table>

    <p style="color:#555;font-size:13px;">
      Un empêchement ? Contactez-nous${garage?.telephone ? ` au ${echapperHtml(garage.telephone)}` : ""} pour reporter votre rendez-vous.
    </p>

    <p style="margin-top:24px;">Merci de votre confiance,<br>${echapperHtml(nomGarage)}</p>
  </div>`;

  const envoi = await envoyerCourriel({
    destinataire: client.email,
    nomExpediteur: nomGarage,
    sujet: `Confirmation de votre rendez-vous — ${nomGarage}`,
    html,
  });
  if (!envoi.ok) {
    return NextResponse.json({ error: envoi.erreur }, { status: envoi.statut });
  }

  return NextResponse.json({ ok: true, envoyeeA: client.email });
}
