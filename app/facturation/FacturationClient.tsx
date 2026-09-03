"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import Bouton from "@/components/ui/Bouton";
import Badge, { type ToneBadge } from "@/components/ui/Badge";

type AbonnementStatut =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | null;
type StatutGarage = "actif" | "suspendu" | "resilie";

type Garage = {
  nom: string;
  statut: StatutGarage;
  abonnement_statut: AbonnementStatut;
  stripe_customer_id: string | null;
};

const TON_STATUT_ABONNEMENT: Record<string, ToneBadge> = {
  trialing: "ambre",
  active: "emeraude",
  past_due: "rouge",
  canceled: "ardoise",
  unpaid: "rouge",
  incomplete: "ardoise",
  incomplete_expired: "ardoise",
};

const LABEL_STATUT_ABONNEMENT: Record<string, string> = {
  trialing: "Essai gratuit",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  unpaid: "Impayé",
  incomplete: "Incomplet",
  incomplete_expired: "Expiré",
};

const LABEL_STATUT_GARAGE: Record<StatutGarage, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  resilie: "Résilié",
};

export default function FacturationClient(props: { garageInitial: Garage | null; estAdmin: boolean }) {
  return (
    <Suspense fallback={null}>
      <FacturationContenu {...props} />
    </Suspense>
  );
}

// Accessible à tout employé du garage, pas seulement l'admin (voir
// page.tsx) : quelqu'un redirigé ici par le blocage du middleware doit
// comprendre pourquoi, même s'il ne peut rien faire lui-même.
function FacturationContenu({ garageInitial, estAdmin }: { garageInitial: Garage | null; estAdmin: boolean }) {
  const searchParams = useSearchParams();
  const bloque = searchParams.get("bloque") === "1";
  const { afficher } = useToast();
  const [enCours, setEnCours] = useState(false);

  async function ouvrirCheckout() {
    setEnCours(true);
    try {
      const res = await fetch("/api/facturation/creer-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur ?? "Erreur inconnue.");
      window.location.href = data.url;
    } catch (e) {
      afficher({ titre: "Impossible d'ouvrir le paiement", description: (e as Error).message, severite: "danger" });
      setEnCours(false);
    }
  }

  async function ouvrirPortail() {
    setEnCours(true);
    try {
      const res = await fetch("/api/facturation/portail", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur ?? "Erreur inconnue.");
      window.location.href = data.url;
    } catch (e) {
      afficher({ titre: "Impossible d'ouvrir le portail", description: (e as Error).message, severite: "danger" });
      setEnCours(false);
    }
  }

  const abonnementStatut = garageInitial?.abonnement_statut ?? null;
  const garageSuspendu = garageInitial != null && garageInitial.statut !== "actif";

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-display font-black uppercase tracking-wide text-mf-text">
          <CreditCard className="w-5 h-5" /> Facturation
        </h1>
        <p className="text-sm text-mf-text-2">Abonnement de {garageInitial?.nom ?? "votre garage"}</p>
      </div>

      {bloque && (
        <div className="mb-4 flex items-start gap-3 bg-mf-red-soft text-mf-red border border-mf-red/30 rounded-mf-md p-4 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {garageSuspendu
              ? "Ce garage a été suspendu — l'accès à l'application est bloqué."
              : "L'accès à l'application a été suspendu suite à un problème avec l'abonnement."}
          </span>
        </div>
      )}

      <div className="bg-mf-surface border border-mf-border rounded-mf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-mf-text-3 uppercase tracking-wide">Statut</span>
          {garageSuspendu ? (
            <Badge tone="rouge">{LABEL_STATUT_GARAGE[garageInitial!.statut]}</Badge>
          ) : (
            <Badge tone={abonnementStatut ? TON_STATUT_ABONNEMENT[abonnementStatut] : "ardoise"}>
              {abonnementStatut ? LABEL_STATUT_ABONNEMENT[abonnementStatut] : "Aucun abonnement"}
            </Badge>
          )}
        </div>

        {garageSuspendu ? (
          <p className="text-sm text-mf-text-2">
            Ce garage a été suspendu par la plateforme — contacte le support pour le réactiver.
          </p>
        ) : !estAdmin ? (
          <p className="text-sm text-mf-text-2">
            Seul l'administrateur du garage peut gérer l'abonnement — contacte-le.
          </p>
        ) : garageInitial?.stripe_customer_id ? (
          <Bouton onClick={ouvrirPortail} enEnvoi={enCours} className="w-full">
            Gérer mon abonnement
          </Bouton>
        ) : (
          <>
            <p className="text-sm text-mf-text-2 mb-4">
              99 $ CAD / mois, essai gratuit de 14 jours. Annulable en tout temps.
            </p>
            <Bouton onClick={ouvrirCheckout} enEnvoi={enCours} className="w-full">
              S'abonner
            </Bouton>
          </>
        )}
      </div>
    </div>
  );
}
