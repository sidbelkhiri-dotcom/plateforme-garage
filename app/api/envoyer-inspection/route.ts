import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { envoyerCourriel } from "@/lib/courriel";
import { envoyerSms, smsConfigure } from "@/lib/sms";

function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Envoie (ou renvoie) le lien public d'une inspection au client — même
// infrastructure que envoyer-evaluation/envoyer-facture, réservée au
// personnel du garage concerné (RLS sur bons_travail/inspections fait le
// reste : impossible de cibler l'inspection d'un autre garage).
export async function POST(request: NextRequest) {
  const { inspectionId } = await request.json();
  if (!inspectionId) {
    return NextResponse.json({ error: "Inspection manquante." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const { data: profil } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profil || !["admin", "reception", "mecanicien"].includes(profil.role)) {
    return NextResponse.json({ error: "Rôle non autorisé." }, { status: 403 });
  }

  const { data: inspection } = await supabase.from("inspections").select("*").eq("id", inspectionId).single();
  if (!inspection) {
    return NextResponse.json({ error: "Inspection introuvable." }, { status: 404 });
  }

  const { data: bon } = await supabase.from("bons_travail").select("numero, client_id").eq("id", inspection.bon_travail_id).single();
  if (!bon) {
    return NextResponse.json({ error: "Bon de travail introuvable." }, { status: 404 });
  }

  const [{ data: client }, { data: garage }] = await Promise.all([
    bon.client_id
      ? supabase.from("clients").select("nom, email, telephone").eq("id", bon.client_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("garages").select("nom").eq("id", inspection.garage_id).single(),
  ]);

  if (!client?.email && !client?.telephone) {
    return NextResponse.json({ error: "Ce client n'a ni courriel ni téléphone enregistré." }, { status: 400 });
  }

  const nomGarage = garage?.nom ?? "Votre garage";
  const origin = new URL(request.url).origin;
  const lien = `${origin}/inspection/${inspection.jeton_acces}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <div style="border-bottom:2px solid #0B5BE8;padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.02em;">${echapperHtml(nomGarage)}</div>
    </div>
    <p>Bonjour ${echapperHtml(client.nom)},</p>
    <p>Voici les points relevés lors de l'inspection de votre véhicule (bon de travail <b>${echapperHtml(bon.numero)}</b>), avec photos à l'appui.</p>
    <p>Cliquez sur le lien ci-dessous pour consulter chaque point et approuver ou refuser les réparations proposées :</p>
    <p style="margin:24px 0;">
      <a href="${lien}" style="display:inline-block;background:#0B5BE8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">Voir l'inspection</a>
    </p>
    <p style="color:#555;font-size:13px;">Ce lien est personnel, ne le transférez pas.</p>
    <p style="margin-top:24px;">Merci de votre confiance,<br>${echapperHtml(nomGarage)}</p>
  </div>`;

  const resultats: { canal: "courriel" | "sms"; ok: boolean; erreur?: string }[] = [];

  if (client.email) {
    const envoi = await envoyerCourriel({
      destinataire: client.email,
      nomExpediteur: nomGarage,
      sujet: `Inspection de votre véhicule — ${bon.numero} — ${nomGarage}`,
      html,
    });
    resultats.push({ canal: "courriel", ok: envoi.ok, erreur: envoi.ok ? undefined : envoi.erreur });
  }

  if (client.telephone && smsConfigure()) {
    const message = `${nomGarage} : voici le lien pour consulter et approuver l'inspection de votre véhicule (${bon.numero}) : ${lien}`;
    const envoi = await envoyerSms({ destinataire: client.telephone, message });
    resultats.push({ canal: "sms", ok: envoi.ok, erreur: envoi.ok ? undefined : envoi.erreur });
  }

  const auMoinsUnEnvoiReussi = resultats.some((r) => r.ok);
  if (!auMoinsUnEnvoiReussi) {
    const erreurs = resultats.map((r) => r.erreur).filter(Boolean).join(" / ") || "Aucun canal d'envoi disponible.";
    return NextResponse.json({ error: erreurs }, { status: 502 });
  }

  // Un renvoi ne doit jamais faire régresser le statut (ex: le client a
  // déjà répondu, statut 'repondue' — renvoyer le lien ne l'annule pas).
  await supabase
    .from("inspections")
    .update({
      envoyee_le: new Date().toISOString(),
      ...(inspection.statut === "brouillon" ? { statut: "envoyee" } : {}),
    })
    .eq("id", inspectionId);

  const envoyeeA = [
    resultats.find((r) => r.canal === "courriel" && r.ok) ? client.email : null,
    resultats.find((r) => r.canal === "sms" && r.ok) ? client.telephone : null,
  ]
    .filter(Boolean)
    .join(" et ");

  return NextResponse.json({ ok: true, envoyeeA, resultats });
}
