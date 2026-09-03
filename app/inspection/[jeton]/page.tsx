"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { urlPubliquePhotoInspection } from "@/lib/inspectionPhotos";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Bouton from "@/components/ui/Bouton";

type EtatPoint = "bon" | "a_surveiller" | "a_reparer";
type DecisionClient = "approuve" | "refuse" | null;
type Photo = { identifiant_public: string; chemin: string };
type Point = {
  id: string;
  description: string;
  etat: EtatPoint;
  recommandation: string | null;
  prix_estime: number | null;
  decision_client: DecisionClient;
  photos: Photo[];
};

const TON_ETAT: Record<EtatPoint, ToneBadge> = { bon: "emeraude", a_surveiller: "ambre", a_reparer: "rouge" };
const LABEL_ETAT: Record<EtatPoint, string> = { bon: "Bon", a_surveiller: "À surveiller", a_reparer: "À réparer" };

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

// Page 100% anonyme — aucune session, aucun compte. Le jeton dans l'URL
// est la seule preuve d'accès, vérifiée côté serveur par la fonction
// security definer obtenir_inspection_publique() (jamais par RLS
// directe, voir migration 2026-08-25). Referrer-Policy no-referrer sur
// cette page pour limiter la fuite du jeton via un clic sortant.
export default function InspectionPubliquePage({ params }: { params: { jeton: string } }) {
  const supabase = createClient();
  const [nomGarage, setNomGarage] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function charger() {
    const { data, error } = await supabase.rpc("obtenir_inspection_publique", { p_jeton: params.jeton });
    if (error) {
      setErreur(error.message);
      return;
    }
    setNomGarage(data.nom_garage);
    setPoints(data.points);
  }

  async function repondre(pointId: string, decision: "approuve" | "refuse") {
    setEnCours(pointId);
    const { error } = await supabase.rpc("repondre_inspection_point", {
      p_jeton: params.jeton,
      p_point_id: pointId,
      p_decision: decision,
    });
    setEnCours(null);
    if (error) {
      setErreur(error.message);
      return;
    }
    setPoints((pts) => pts?.map((p) => (p.id === pointId ? { ...p, decision_client: decision } : p)) ?? null);
  }

  if (erreur) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mf-bg p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-mf-red mx-auto mb-3" />
          <p className="text-sm text-mf-text">{erreur}</p>
        </div>
      </div>
    );
  }

  if (!points) {
    return <div className="min-h-screen flex items-center justify-center bg-mf-bg" />;
  }

  return (
    <div className="min-h-screen bg-mf-bg py-8 px-4">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <div className="text-lg font-black uppercase tracking-wide text-mf-text">{nomGarage ?? "Votre garage"}</div>
          <p className="text-sm text-mf-text-2 mt-1">
            Voici les points relevés lors de l'inspection de votre véhicule. Approuvez ou refusez chaque réparation
            proposée.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {points.map((point) => (
            <div key={point.id} className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
              <Badge tone={TON_ETAT[point.etat]}>{LABEL_ETAT[point.etat]}</Badge>
              <div className="text-sm text-mf-text font-medium mt-2">{point.description}</div>
              {point.recommandation && <div className="text-sm text-mf-text-2 mt-1">{point.recommandation}</div>}
              {point.prix_estime != null && (
                <div className="text-sm text-mf-text-3 mt-1">Prix estimé : {formatMoney(point.prix_estime)}</div>
              )}

              {point.photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {point.photos.map((photo) => (
                    <a key={photo.identifiant_public} href={urlPubliquePhotoInspection(supabase, photo.chemin)} target="_blank" rel="noopener noreferrer">
                      <img
                        src={urlPubliquePhotoInspection(supabase, photo.chemin)}
                        alt=""
                        className="w-20 h-16 object-cover rounded-mf-sm border border-mf-border"
                      />
                    </a>
                  ))}
                </div>
              )}

              {point.decision_client ? (
                <div className="mt-3">
                  <Badge tone={point.decision_client === "approuve" ? "emeraude" : "rouge"}>
                    {point.decision_client === "approuve" ? "Vous avez approuvé" : "Vous avez refusé"}
                  </Badge>
                </div>
              ) : (
                <div className="flex gap-2 mt-3">
                  <Bouton
                    onClick={() => repondre(point.id, "approuve")}
                    enEnvoi={enCours === point.id}
                    className="flex-1"
                  >
                    Approuver
                  </Bouton>
                  <Bouton
                    variante="secondaire"
                    onClick={() => repondre(point.id, "refuse")}
                    enEnvoi={enCours === point.id}
                    className="flex-1"
                  >
                    Refuser
                  </Bouton>
                </div>
              )}
            </div>
          ))}
          {points.length === 0 && (
            <div className="bg-mf-surface rounded-mf-md border border-mf-border p-8 text-center text-sm text-mf-text-2">
              <Camera className="w-6 h-6 mx-auto mb-2 text-mf-text-3" />
              Aucun point d'inspection pour l'instant.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
