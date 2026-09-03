"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import Bouton from "@/components/ui/Bouton";
import Badge, { type ToneBadge } from "@/components/ui/Badge";

type AbonnementStatut = "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete" | "incomplete_expired" | null;

type Garage = {
  nom: string;
  abonnement_statut: AbonnementStatut;
  stripe_customer_id: string | null;
};

const TON_STATUT: Record<string, ToneBadge> = {
  trialing: "ambre",
  active: "emeraude",
  past_due: "rouge",
  canceled: "ardoise",
  unpaid: "rouge",
  incomplete: "ardoise",
  incomplete_expired: "ardoise",
};

const LABEL_STATUT: Record<string, string> = {
  trialing: "Essai gratuit",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Annulé",
  unpaid: "Impayé",
  incomplete: "Incomplet",
  incomplete_expired: "Expiré",
};

// L'abonnement_statut n'est encore qu'informatif (voir la migration
// 2026-09-19) : rien ne bloque automatiquement l'accès à l'application
// si le paiement échoue — cette page sert seulement à s'abonner et à
// gérer l'abonnement existant.
export default function FacturationClient({ garageInitial }: { garageInitial: Garage | null }) {
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

  const statut = garageInitial?.abonnement_statut ?? null;

  return (
    <div className="p-6 max-w-lg">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-display font-black uppercase tracking-wide text-mf-text">
          <CreditCard className="w-5 h-5" /> Facturation
        </h1>
        <p className="text-sm text-mf-text-2">Abonnement de {garageInitial?.nom ?? "votre garage"}</p>
      </div>

      <div className="bg-mf-surface border border-mf-border rounded-mf-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-mf-text-3 uppercase tracking-wide">Statut</span>
          <Badge tone={statut ? TON_STATUT[statut] : "ardoise"}>
            {statut ? LABEL_STATUT[statut] : "Aucun abonnement"}
          </Badge>
        </div>

        {garageInitial?.stripe_customer_id ? (
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
