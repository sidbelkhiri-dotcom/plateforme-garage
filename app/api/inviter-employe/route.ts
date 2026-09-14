import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { courrielConfigure, envoyerCourriel } from "@/lib/courriel";

function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const LIBELLE_ROLE: Record<string, string> = {
  admin: "administrateur",
  reception: "réception",
  mecanicien: "mécanicien",
};

// Invitation d'un employé par l'administrateur du garage.
//
// Le partage des rôles est volontaire :
//   - preparer_invitation(), appelée avec la SESSION de l'admin, décide :
//     est-il admin, son garage est-il actif, le courriel est-il libre. Le
//     garage visé est garage_actuel(), jamais une valeur envoyée par le
//     navigateur.
//   - la clé service ne sert qu'après ce feu vert, et seulement à ce que
//     la base ne sait pas faire : créer le compte (API d'administration) et
//     obtenir le jeton du lien. Elle ne lit ni n'écrit aucune table.
//
// Le lien pointe directement vers /auth/confirmation avec token_hash : il
// marche quel que soit l'appareil qui ouvre le courriel, et ne dépend ni du
// gabarit anglais de Supabase ni de sa liste d'adresses de redirection.
export async function POST(request: NextRequest) {
  let corps: { courriel?: string; nom?: string; role?: string };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête illisible." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  // Vérifié avant de poser l'invitation : sans envoi possible, elle
  // resterait en attente sans que personne ne reçoive jamais le lien.
  if (!courrielConfigure()) {
    return NextResponse.json(
      { error: "L'envoi de courriels n'est pas configuré sur ce serveur : l'invitation ne pourrait pas partir." },
      { status: 500 }
    );
  }

  const { data: invitation, error: erreurInvitation } = await supabase.rpc("preparer_invitation", {
    p_courriel: corps.courriel ?? "",
    p_nom: corps.nom ?? "",
    p_role: corps.role ?? "",
  });
  if (erreurInvitation) {
    return NextResponse.json({ error: erreurInvitation.message }, { status: 400 });
  }
  const renvoi = Boolean((invitation as { renvoi?: boolean } | null)?.renvoi);
  const courriel = String(corps.courriel).trim().toLowerCase();

  const admin = createServiceRoleClient();
  // Premier envoi : le compte est créé en tant qu'invité (invited_at), ce
  // qui déclenche le rattachement au garage dans handle_new_user(). Renvoi :
  // le compte existe déjà, un lien de réinitialisation mène au même écran.
  const { data: lienGenere, error: erreurLien } = await admin.auth.admin.generateLink(
    renvoi ? { type: "recovery", email: courriel } : { type: "invite", email: courriel }
  );
  const jeton = lienGenere?.properties?.hashed_token;
  if (erreurLien || !jeton) {
    return NextResponse.json(
      { error: "Le compte de l'employé n'a pas pu être créé. Réessayez dans un instant." },
      { status: 502 }
    );
  }

  const [{ data: parametres }, { data: profilAdmin }] = await Promise.all([
    supabase.from("parametres").select("nom").single(),
    supabase.from("profiles").select("nom").eq("id", user.id).single(),
  ]);
  const nomGarage = parametres?.nom ?? "Votre garage";
  const nomAdmin = profilAdmin?.nom ?? "L'administrateur";

  const suite = encodeURIComponent("/nouveau-mot-de-passe?bienvenue=1");
  const lien = `${request.nextUrl.origin}/auth/confirmation?token_hash=${encodeURIComponent(jeton)}&type=${renvoi ? "recovery" : "invite"}&suite=${suite}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111f29;">
    <div style="border-bottom:2px solid #1a5c8a;padding-bottom:12px;margin-bottom:20px;">
      <div style="font-size:20px;font-weight:bold;">${echapperHtml(nomGarage)}</div>
    </div>
    <p>Bonjour ${echapperHtml(corps.nom)},</p>
    <p>${echapperHtml(nomAdmin)} vous ajoute à l'équipe de <strong>${echapperHtml(nomGarage)}</strong> sur Garagenda, avec le rôle <strong>${echapperHtml(LIBELLE_ROLE[corps.role ?? ""] ?? corps.role)}</strong>.</p>
    <p>Pour activer votre compte, choisissez votre mot de passe :</p>
    <p style="margin:28px 0;">
      <a href="${lien}" style="display:inline-block;background:#1a5c8a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:0;font-weight:bold;">Activer mon compte</a>
    </p>
    <p style="color:#555;font-size:13px;">Ce lien est personnel et valable pour une durée limitée. S'il a expiré, demandez à ${echapperHtml(nomAdmin)} de renvoyer l'invitation.</p>
    <p style="color:#555;font-size:13px;">Vous ne connaissez pas ${echapperHtml(nomGarage)} ? Ignorez ce message : aucun compte ne sera activé sans vous.</p>
  </div>`;

  const envoi = await envoyerCourriel({
    destinataire: courriel,
    sujet: `${nomGarage} vous invite sur Garagenda`,
    html,
    nomExpediteur: nomGarage,
  });
  if (!envoi.ok) {
    return NextResponse.json(
      { error: `L'invitation est prête, mais le courriel n'est pas parti (${envoi.erreur}). Utilisez « Renvoyer ».` },
      { status: envoi.statut }
    );
  }

  return NextResponse.json({ ok: true, renvoi });
}
