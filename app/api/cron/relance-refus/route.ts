import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { envoyerCourriel } from "@/lib/courriel";
import { envoyerSms, smsConfigure } from "@/lib/sms";
import { garageOperationnel, type EtatGarage } from "@/lib/abonnement";

// Délai avant relance — assez long pour ne pas paraître insistant, assez
// court pour rester pertinent (le client se souvient encore du contexte).
const DELAI_JOURS = 60;

// Au-delà, la liste est résumée dans le SMS : chaque tranche de 160
// caractères est facturée comme un texto distinct.
const LONGUEUR_MAX_LISTE_SMS = 90;

function echapperHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Point = { id: string; description: string; inspection_id: string };

// Appelée une fois par jour par Vercel Cron (voir vercel.json). Relance
// automatique sur les points d'inspection refusés par le client il y a
// plus de DELAI_JOURS — ni Tekmetric ni Shopmonkey n'automatisent bien ce
// suivi (comparatif indépendant du 8 sept. 2026), donc pas juste du
// rattrapage. Aucune session utilisateur : client service_role, comme
// rappels-rendez-vous. CRON_SECRET est le seul verrou.
//
// UN MESSAGE PAR VISITE, PAS PAR POINT. Jusqu'au 2026-09-12 la boucle
// tournait sur les points : un client qui avait refusé six recommandations
// lors d'une même visite recevait six courriels et six SMS dans la même
// minute — du pourriel au nom du garage, et six textos facturés. Les
// points sont désormais regroupés par inspection, ce qui correspond aussi
// à la formulation du message (« lors de votre dernière visite »).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const enTete = request.headers.get("authorization");
  if (!secret || enTete !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const seuil = new Date();
  seuil.setUTCDate(seuil.getUTCDate() - DELAI_JOURS);

  const { data: points } = await supabase
    .from("inspection_points")
    .select("id, description, inspection_id")
    .eq("decision_client", "refuse")
    .is("relance_envoyee_le", null)
    .lt("repondu_le", seuil.toISOString());

  const parInspection = new Map<string, Point[]>();
  for (const point of (points ?? []) as Point[]) {
    const groupe = parInspection.get(point.inspection_id) ?? [];
    groupe.push(point);
    parInspection.set(point.inspection_id, groupe);
  }

  let clientsContactes = 0;
  let pointsRelances = 0;
  let ignoresGarageBloque = 0;
  const echecs: string[] = [];

  for (const [inspectionId, groupe] of Array.from(parInspection)) {
    // revoque = le bon est passé à facturé/annulé depuis — relancer sur
    // une réparation qui ne s'applique plus n'aurait aucun sens.
    const { data: inspection } = await supabase
      .from("inspections")
      .select("bon_travail_id, garage_id, revoque")
      .eq("id", inspectionId)
      .single();
    if (!inspection || inspection.revoque) continue;

    const { data: bon } = await supabase
      .from("bons_travail")
      .select("numero, client_id")
      .eq("id", inspection.bon_travail_id)
      .single();
    if (!bon) continue;

    const [{ data: client }, { data: garage }] = await Promise.all([
      bon.client_id
        ? supabase.from("clients").select("nom, email, telephone").eq("id", bon.client_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("garages").select("nom, statut, abonnement_statut").eq("id", inspection.garage_id).single(),
    ]);
    if (!client) continue;

    const etatGarage = garage as (EtatGarage & { nom: string }) | null;

    // La clé service contourne le gel d'écriture : sans ce contrôle, un
    // garage suspendu, en échec de paiement ou résilié continuait de
    // relancer ses clients en son nom. Les points ne sont pas marqués :
    // si le garage est rétabli, la relance partira au passage suivant.
    if (!etatGarage || !garageOperationnel(etatGarage)) {
      ignoresGarageBloque += groupe.length;
      continue;
    }

    const nomGarage = etatGarage.nom ?? "Votre garage";
    const descriptions = groupe.map((p) => p.description);
    const plusieurs = descriptions.length > 1;
    let auMoinsUnEnvoiReussi = false;

    if (client.email) {
      const liste = plusieurs
        ? `<ul style="background:#f5f5f5;padding:12px 16px 12px 32px;border-radius:6px;font-weight:bold;margin:0;">${descriptions
            .map((d) => `<li style="margin:4px 0;">${echapperHtml(d)}</li>`)
            .join("")}</ul>`
        : `<p style="background:#f5f5f5;padding:12px 16px;border-radius:6px;font-weight:bold;">${echapperHtml(descriptions[0])}</p>`;
      const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111;">
        <div style="border-bottom:2px solid #0B5BE8;padding-bottom:12px;margin-bottom:20px;">
          <div style="font-size:18px;font-weight:900;text-transform:uppercase;letter-spacing:0.02em;">${echapperHtml(nomGarage)}</div>
        </div>
        <p>Bonjour ${echapperHtml(client.nom)},</p>
        <p>Lors de votre dernière visite (bon de travail <b>${echapperHtml(bon.numero)}</b>), vous aviez choisi de reporter ${
          plusieurs ? "les réparations suivantes" : "la réparation suivante"
        } :</p>
        ${liste}
        <p>Si vous souhaitez qu'on y jette un œil de nouveau, n'hésitez pas à nous contacter pour reprendre rendez-vous.</p>
        <p style="margin-top:24px;">Merci de votre confiance,<br>${echapperHtml(nomGarage)}</p>
      </div>`;
      const envoi = await envoyerCourriel({
        destinataire: client.email,
        nomExpediteur: nomGarage,
        sujet: `Un suivi pour votre véhicule — ${nomGarage}`,
        html,
      });
      if (envoi.ok) auMoinsUnEnvoiReussi = true;
    }

    if (client.telephone && smsConfigure()) {
      let objet: string;
      if (!plusieurs) {
        objet = `« ${descriptions[0]} »`;
      } else {
        let liste = descriptions.join(", ");
        if (liste.length > LONGUEUR_MAX_LISTE_SMS) liste = `${liste.slice(0, LONGUEUR_MAX_LISTE_SMS).trimEnd()}…`;
        objet = `${descriptions.length} réparations (${liste})`;
      }
      const message = `${nomGarage} : un suivi sur ${objet}, reportée${plusieurs ? "s" : ""} lors de votre dernière visite. Contactez-nous si vous voulez qu'on ${plusieurs ? "les" : "la"} réévalue.`;
      const envoi = await envoyerSms({ destinataire: client.telephone, message });
      if (envoi.ok) auMoinsUnEnvoiReussi = true;
    }

    if (auMoinsUnEnvoiReussi) {
      clientsContactes++;
      pointsRelances += groupe.length;
      await supabase
        .from("inspection_points")
        .update({ relance_envoyee_le: new Date().toISOString() })
        .in(
          "id",
          groupe.map((p) => p.id),
        );
    } else {
      echecs.push(inspectionId);
    }
  }

  return NextResponse.json({ ok: true, clientsContactes, pointsRelances, ignoresGarageBloque, echecs });
}
