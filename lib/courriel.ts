// ============================================================
// Envoi de courriels transactionnels via Resend.
//
// Pourquoi pas Gmail : l'authentification par mot de passe d'application
// a été refusée de façon répétée (535 BadCredentials) malgré une clé
// valide et la validation en deux étapes activée. Resend est conçu pour
// l'envoi automatisé depuis une application, avec un domaine vérifié —
// pas de blocage de sécurité à contourner.
//
// Pourquoi l'API HTTP plutôt que le paquet `resend` : une dépendance de
// moins à installer et à tenir à jour, et l'appel tient en quelques
// lignes. Ajouter un paquet npm impose aussi un `npm install` manuel,
// qui a déjà cassé le serveur de développement par le passé.
//
// RESEND_API_KEY et COURRIEL_EXPEDITEUR ne sont jamais préfixés
// NEXT_PUBLIC_ : ils ne sont lus que côté serveur, dans les Route
// Handlers, jamais exposés au navigateur.
// ============================================================

type Resultat = { ok: true } | { ok: false; erreur: string; statut: number };

export function courrielConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.COURRIEL_EXPEDITEUR);
}

export async function envoyerCourriel({
  destinataire,
  sujet,
  html,
  nomExpediteur,
}: {
  destinataire: string;
  sujet: string;
  html: string;
  nomExpediteur: string;
}): Promise<Resultat> {
  const cle = process.env.RESEND_API_KEY;
  const expediteur = process.env.COURRIEL_EXPEDITEUR;

  if (!cle || !expediteur) {
    return {
      ok: false,
      statut: 500,
      erreur: "Envoi de courriel non configuré (RESEND_API_KEY / COURRIEL_EXPEDITEUR manquants).",
    };
  }

  let reponse: Response;
  try {
    reponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cle}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${nomExpediteur} <${expediteur}>`,
        to: [destinataire],
        subject: sujet,
        html,
      }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur inconnue.";
    return { ok: false, statut: 502, erreur: `Envoi échoué : ${message}` };
  }

  if (!reponse.ok) {
    // Resend renvoie un message explicite (domaine non vérifié, clé
    // invalide, destinataire refusé) — on le remonte tel quel plutôt que
    // de le masquer derrière un message générique.
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
