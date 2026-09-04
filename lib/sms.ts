// ============================================================
// Envoi de textos via Twilio — même patron que lib/courriel.ts (API
// HTTP directe, pas de paquet npm à installer/maintenir).
//
// TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER ne sont
// jamais préfixés NEXT_PUBLIC_ : lus côté serveur uniquement.
// ============================================================

type Resultat = { ok: true } | { ok: false; erreur: string; statut: number };

export function smsConfigure(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER
  );
}

// Les numéros sont saisis en texte libre (ex. "514-555-1234", "(514) 555
// 1234") — Twilio exige le format E.164 (+15145551234). Renvoie null si
// le numéro n'a manifestement pas 10 chiffres nord-américains, plutôt
// que d'envoyer à un numéro probablement invalide.
export function normaliserTelephone(brut: string): string | null {
  const chiffres = brut.replace(/\D/g, "");
  if (chiffres.length === 10) return `+1${chiffres}`;
  if (chiffres.length === 11 && chiffres.startsWith("1")) return `+${chiffres}`;
  return null;
}

export async function envoyerSms({
  destinataire,
  message,
}: {
  destinataire: string;
  message: string;
}): Promise<Resultat> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const depuis = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !depuis) {
    return { ok: false, statut: 500, erreur: "Envoi de texto non configuré (TWILIO_* manquants)." };
  }

  const numero = normaliserTelephone(destinataire);
  if (!numero) {
    return { ok: false, statut: 400, erreur: "Numéro de téléphone invalide." };
  }

  let reponse: Response;
  try {
    reponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: depuis, To: numero, Body: message }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue.";
    return { ok: false, statut: 502, erreur: `Envoi échoué : ${msg}` };
  }

  if (!reponse.ok) {
    let detail = `code ${reponse.status}`;
    try {
      const corps = await reponse.json();
      if (corps?.message) detail = corps.message;
    } catch {
      // corps illisible : on garde le code HTTP
    }
    return { ok: false, statut: 502, erreur: `Envoi échoué : ${detail}` };
  }

  return { ok: true };
}
