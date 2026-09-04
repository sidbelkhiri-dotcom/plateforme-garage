import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { envoyerCourriel } from "@/lib/courriel";

function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Demande d'avis Google déclenchée manuellement par le personnel sur une
// facture — même infrastructure d'envoi que envoyer-facture, réservée
// admin/reception pour la même raison (éviter qu'un client reçoive une
// demande à répétition par erreur).
export async function POST(request: NextRequest) {
  const { factureId } = await request.json();
  if (!factureId) {
    return NextResponse.json({ error: "Facture manquante." }, { status: 400 });
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
    return NextResponse.json({ error: "Rôle non autorisé." }, { status: 403 });
  }

  const { data: facture } = await supabase.from("factures").select("client_id").eq("id", factureId).single();
  if (!facture) {
    return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  }

  const [{ data: client }, { data: garage }] = await Promise.all([
    facture.client_id ? supabase.from("clients").select("nom, email").eq("id", facture.client_id).single() : Promise.resolve({ data: null }),
    supabase.from("parametres").select("nom, lien_avis_google").single(),
  ]);

  if (!client?.email) {
    return NextResponse.json({ error: "Ce client n'a pas d'adresse courriel enregistrée." }, { status: 400 });
  }
  if (!garage?.lien_avis_google) {
    return NextResponse.json({ error: "Aucun lien d'avis Google configuré (voir Paramètres)." }, { status: 400 });
  }

  const nomGarage = garage.nom ?? "Votre garage";
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
    <div style="border-bottom:2px solid #0B5BE8;padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.02em;">${echapperHtml(nomGarage)}</div>
    </div>
    <p>Bonjour ${echapperHtml(client.nom)},</p>
    <p>Merci d'avoir fait confiance à ${echapperHtml(nomGarage)}. Si vous avez apprécié notre service, un avis Google prend une minute et nous aide énormément :</p>
    <p style="margin:24px 0;">
      <a href="${echapperHtml(garage.lien_avis_google)}" style="display:inline-block;background:#0B5BE8;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:bold;">Laisser un avis</a>
    </p>
    <p style="margin-top:24px;">Merci de votre confiance,<br>${echapperHtml(nomGarage)}</p>
  </div>`;

  const envoi = await envoyerCourriel({
    destinataire: client.email,
    nomExpediteur: nomGarage,
    sujet: `Votre avis compte pour nous — ${nomGarage}`,
    html,
  });
  if (!envoi.ok) {
    return NextResponse.json({ error: envoi.erreur }, { status: envoi.statut });
  }

  return NextResponse.json({ ok: true, envoyeeA: client.email });
}
