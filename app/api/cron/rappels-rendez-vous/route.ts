import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/serviceRole";
import { envoyerSms, smsConfigure } from "@/lib/sms";
import { formatTimeShort } from "@/lib/dates";

// Appelée une fois par jour par Vercel Cron (voir vercel.json) — aucune
// session utilisateur, donc aucun garage_actuel() : on doit balayer tous
// les garages nous-mêmes via le client service_role, exactement comme le
// webhook Stripe. CRON_SECRET est le seul verrou (Vercel l'envoie en
// en-tête Authorization sur les appels programmés, voir la doc Vercel
// Cron Jobs) — sans lui, n'importe qui pourrait déclencher l'envoi de
// centaines de textos en appelant cette URL.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const enTete = request.headers.get("authorization");
  if (!secret || enTete !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (!smsConfigure()) {
    return NextResponse.json({ ok: true, envoyes: 0, note: "SMS non configuré." });
  }

  const supabase = createServiceRoleClient();

  // "Demain" en heure de l'Est plutôt qu'UTC — un rappel envoyé la
  // veille doit correspondre au jour réel du client, pas au jour UTC qui
  // peut différer de quelques heures.
  const demain = new Date();
  demain.setUTCHours(demain.getUTCHours() - 5); // approximation EST/EDT, suffisant pour une date de rappel
  demain.setUTCDate(demain.getUTCDate() + 1);
  const dateDemain = demain.toISOString().slice(0, 10);

  const { data: rendezVous } = await supabase
    .from("rendez_vous")
    .select("id, heure, description, client_id, garage_id, garages(nom), clients(nom, telephone)")
    .eq("date", dateDemain)
    .in("statut", ["prevu", "confirme"])
    .is("rappel_envoye_le", null);

  let envoyes = 0;
  const echecs: string[] = [];

  for (const rdv of rendezVous ?? []) {
    const client = rdv.clients as unknown as { nom: string; telephone: string | null } | null;
    const garage = rdv.garages as unknown as { nom: string } | null;
    if (!client?.telephone) continue;

    const message = `${garage?.nom ?? "Votre garage"} : rappel de votre rendez-vous demain à ${formatTimeShort(rdv.heure)}. ${rdv.description}`;
    const envoi = await envoyerSms({ destinataire: client.telephone, message });
    if (envoi.ok) {
      envoyes++;
      await supabase.from("rendez_vous").update({ rappel_envoye_le: new Date().toISOString() }).eq("id", rdv.id);
    } else {
      echecs.push(`${rdv.id}: ${envoi.erreur}`);
    }
  }

  return NextResponse.json({ ok: true, envoyes, echecs });
}
