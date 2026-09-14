"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Eye, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { urlPubliquePhotoInspection } from "@/lib/inspectionPhotos";
import Badge from "@/components/ui/Badge";
import Bouton from "@/components/ui/Bouton";
import Lightbox from "@/components/ui/Lightbox";

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

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

// Qu'est-ce qui mérite un bouton « Approuver » ? Un point à réparer, ou un
// point à surveiller pour lequel le mécanicien a chiffré une intervention.
// Jamais un point en bon état : la première version proposait d'approuver
// ou de refuser « Filtre à air moteur — Bon », ce qui ne veut rien dire et
// laisse un client consciencieux se demander ce qu'il accepte. Un point à
// surveiller sans prix est une information, pas une offre : il n'y a rien
// à acheter aujourd'hui. Rien n'est perdu côté atelier, l'import des points
// approuvés vers l'évaluation a besoin d'un prix de toute façon.
function estProposable(p: Point) {
  return p.etat === "a_reparer" || (p.etat === "a_surveiller" && p.prix_estime != null);
}

// Du plus urgent au plus rassurant. L'ordre saisi par le mécanicien
// mélangeait les états — réparer, surveiller, réparer, bon — et un point en
// bon état pesait autant qu'un problème de sécurité.
const SECTIONS: { etat: EtatPoint; titre: string; Icone: typeof AlertTriangle; teinte: string }[] = [
  { etat: "a_reparer", titre: "À réparer", Icone: AlertTriangle, teinte: "text-mf-red" },
  { etat: "a_surveiller", titre: "À surveiller", Icone: Eye, teinte: "text-mf-warning" },
  { etat: "bon", titre: "En bon état", Icone: CheckCircle2, teinte: "text-mf-success" },
];

// Page 100% anonyme — aucune session, aucun compte. Le jeton dans l'URL
// est la seule preuve d'accès, vérifiée côté serveur par la fonction
// security definer obtenir_inspection_publique() (jamais par RLS
// directe, voir migration 2026-08-25). Referrer-Policy no-referrer sur
// cette page pour limiter la fuite du jeton via un clic sortant.
//
// C'est l'écran qui doit convaincre : un client y décide de dépenser de
// l'argent, souvent sur son téléphone, sans personne à qui poser la
// question. Tout ce qui suit sert cette décision.
export default function InspectionPubliquePage({ params }: { params: { jeton: string } }) {
  const supabase = createClient();
  const [nomGarage, setNomGarage] = useState<string | null>(null);
  const [vehicule, setVehicule] = useState<string | null>(null);
  const [telephoneGarage, setTelephoneGarage] = useState<string | null>(null);
  const [slugGarage, setSlugGarage] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[] | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [enModification, setEnModification] = useState<Set<string>>(new Set());
  const [visionneuse, setVisionneuse] = useState<{ urls: string[]; index: number } | null>(null);

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function charger() {
    const { data, error } = await supabase.rpc("obtenir_inspection_publique", { p_jeton: params.jeton });
    if (error) {
      setErreurChargement(error.message);
      return;
    }
    setNomGarage(data.nom_garage);
    // Fournis par la migration du 2026-10-06. Lus sans les exiger : avant
    // qu'elle soit appliquée, la page s'affiche simplement sans eux.
    setVehicule(data.vehicule ?? null);
    setTelephoneGarage(data.telephone_garage ?? null);
    // Migration 2026-10-15 : sans elle, la page s'affiche sans le lien.
    setSlugGarage(data.slug_garage ?? null);
    setPoints(data.points);
  }

  async function repondre(pointId: string, decision: "approuve" | "refuse") {
    setEnCours(pointId);
    setErreurAction(null);
    const { error } = await supabase.rpc("repondre_inspection_point", {
      p_jeton: params.jeton,
      p_point_id: pointId,
      p_decision: decision,
    });
    setEnCours(null);
    if (error) {
      // Un envoi raté ne doit pas effacer la page entière — c'est ce que
      // faisait la première version, qui remplaçait tout par le message.
      setErreurAction(error.message);
      return;
    }
    setPoints((pts) => pts?.map((p) => (p.id === pointId ? { ...p, decision_client: decision } : p)) ?? null);
    setEnModification((s) => {
      const suivant = new Set(s);
      suivant.delete(pointId);
      return suivant;
    });
  }

  function modifier(pointId: string) {
    setEnModification((s) => new Set(s).add(pointId));
  }

  if (erreurChargement) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mf-bg p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-mf-red mx-auto mb-3" />
          <p className="text-sm text-mf-text">{erreurChargement}</p>
        </div>
      </div>
    );
  }

  if (!points) {
    return <div className="min-h-screen flex items-center justify-center bg-mf-bg" />;
  }

  const proposables = points.filter(estProposable);
  const aDecider = proposables.filter((p) => !p.decision_client).length;
  const totalApprouve = proposables
    .filter((p) => p.decision_client === "approuve")
    .reduce((s, p) => s + (p.prix_estime ?? 0), 0);
  const totalPropose = proposables.reduce((s, p) => s + (p.prix_estime ?? 0), 0);

  return (
    <div className="min-h-screen bg-mf-bg">
      <div className="max-w-lg mx-auto px-4 pt-8 pb-4">
        <header className="mb-6">
          <div className="font-display text-[1.625rem] font-bold uppercase leading-tight tracking-[0.01em] text-mf-text">
            {nomGarage ?? "Votre garage"}
          </div>
          {/* Le véhicule d'abord : un client qui a deux voitures, ou une
              flotte, doit savoir tout de suite de laquelle on parle. */}
          {vehicule && <div className="text-base font-medium text-mf-text mt-1">{vehicule}</div>}
          <p className="text-sm text-mf-text-2 mt-2">
            {proposables.length > 0
              ? "Voici ce que nous avons relevé lors de l'inspection. Pour chaque réparation proposée, dites-nous si vous voulez qu'on la fasse."
              : "Voici ce que nous avons relevé lors de l'inspection de votre véhicule."}
          </p>
          {telephoneGarage && (
            <a
              href={`tel:${telephoneGarage.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px]"
            >
              <Phone className="w-4 h-4" /> Une question ? {telephoneGarage}
            </a>
          )}
        </header>

        {erreurAction && (
          <div className="mb-4 flex items-start gap-2 border border-mf-red bg-mf-red-soft px-3 py-2.5 text-sm text-mf-text">
            <AlertTriangle className="w-4 h-4 text-mf-red shrink-0 mt-0.5" />
            <span>{erreurAction}</span>
          </div>
        )}

        {points.length === 0 && (
          <div className="bg-mf-surface border border-mf-border p-8 text-center text-sm text-mf-text-2">
            <Camera className="w-6 h-6 mx-auto mb-2 text-mf-text-3" />
            Aucun point d'inspection pour l'instant.
          </div>
        )}

        <div className="flex flex-col gap-8">
          {SECTIONS.map(({ etat, titre, Icone, teinte }) => {
            const duGroupe = points.filter((p) => p.etat === etat);
            if (duGroupe.length === 0) return null;
            return (
              <section key={etat}>
                <h2 className="flex items-center gap-2 mb-3 font-display font-bold text-sm uppercase tracking-wide text-mf-text">
                  <Icone className={`w-4 h-4 ${teinte}`} />
                  {titre}
                  <span className="font-sans font-normal text-mf-text-3 normal-case tracking-normal">· {duGroupe.length}</span>
                </h2>

                {etat === "bon" ? (
                  // Une liste de contrôle, pas une pile de cartes : ce qui va
                  // bien rassure, mais ne demande ni décision ni attention.
                  <ul className="bg-mf-surface border border-mf-border divide-y divide-mf-border">
                    {duGroupe.map((p) => (
                      <li key={p.id} className="flex items-start gap-2.5 px-4 py-3 text-sm text-mf-text">
                        <CheckCircle2 className="w-4 h-4 text-mf-success shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div>{p.description}</div>
                          {p.recommandation && <div className="text-mf-text-2 mt-0.5">{p.recommandation}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col gap-3">
                    {duGroupe.map((point) => (
                      <CartePoint
                        key={point.id}
                        point={point}
                        proposable={estProposable(point)}
                        enModification={enModification.has(point.id)}
                        enCours={enCours === point.id}
                        onRepondre={repondre}
                        onModifier={modifier}
                        onOuvrirPhoto={(index) =>
                          setVisionneuse({
                            urls: point.photos.map((ph) => urlPubliquePhotoInspection(supabase, ph.chemin)),
                            index,
                          })
                        }
                        urlPhoto={(chemin) => urlPubliquePhotoInspection(supabase, chemin)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* Loi 25 : le client voit des photos de son véhicule et décide de
            réparations ; il doit pouvoir savoir qui détient ces
            renseignements et comment exercer ses droits. */}
        {slugGarage && (
          <p className="mt-8 text-xs text-mf-text-3 leading-relaxed">
            Vos réponses et les photos de votre véhicule sont conservées par {nomGarage ?? "le garage"}.{" "}
            <a
              href={`/accueil/${slugGarage}/confidentialite`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-mf-blue underline underline-offset-2"
            >
              Vos renseignements personnels
            </a>
          </p>
        )}
      </div>

      {/* Le total reste sous les yeux. On demande au client de dépenser de
          l'argent : c'est le seul chiffre qui compte pour décider, et la
          première version ne l'affichait nulle part — il fallait additionner
          les prix de tête en faisant défiler. */}
      {proposables.length > 0 && (
        <div className="sticky bottom-0 z-10 bg-mf-surface border-t border-mf-border">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="text-sm text-mf-text-2 min-w-0">
              {aDecider > 0 ? (
                <>
                  <span className="font-semibold text-mf-text">{aDecider}</span>{" "}
                  {aDecider > 1 ? "réparations à décider" : "réparation à décider"}
                </>
              ) : (
                <span className="text-mf-text">Merci — le garage a reçu vos réponses.</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-mf-text-3">Approuvé</div>
              <div className="font-mono tabular-nums text-base font-bold text-mf-text leading-tight">
                {formatMoney(totalApprouve)}
              </div>
              {totalPropose > 0 && (
                <div className="font-mono tabular-nums text-xs text-mf-text-3">sur {formatMoney(totalPropose)}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {visionneuse && (
        <Lightbox
          urls={visionneuse.urls}
          index={visionneuse.index}
          onIndexChange={(index) => setVisionneuse((v) => (v ? { ...v, index } : v))}
          onFermer={() => setVisionneuse(null)}
        />
      )}
    </div>
  );
}

function CartePoint({
  point,
  proposable,
  enModification,
  enCours,
  onRepondre,
  onModifier,
  onOuvrirPhoto,
  urlPhoto,
}: {
  point: Point;
  proposable: boolean;
  enModification: boolean;
  enCours: boolean;
  onRepondre: (id: string, decision: "approuve" | "refuse") => void;
  onModifier: (id: string) => void;
  onOuvrirPhoto: (index: number) => void;
  urlPhoto: (chemin: string) => string;
}) {
  const decide = point.decision_client !== null && !enModification;

  return (
    <div className="bg-mf-surface border border-mf-border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-base font-semibold text-mf-text">{point.description}</div>
        {point.prix_estime != null && (
          <div className="font-mono tabular-nums text-base font-bold text-mf-text shrink-0">
            {formatMoney(point.prix_estime)}
          </div>
        )}
      </div>
      {point.recommandation && <p className="text-sm text-mf-text-2 mt-1.5">{point.recommandation}</p>}

      {/* Les photos sont la preuve qui justifie la réparation. Elles faisaient
          56 px de haut et ouvraient l'image brute dans un autre onglet ;
          elles occupent désormais la largeur de la carte et s'agrandissent
          sur place. Une photo seule prend toute la largeur. */}
      {point.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          {point.photos.map((photo, index) => (
            <button
              key={photo.identifiant_public}
              type="button"
              onClick={() => onOuvrirPhoto(index)}
              className={`block focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue ${
                point.photos.length === 1 ? "col-span-2" : ""
              }`}
              aria-label={`Agrandir la photo ${index + 1} : ${point.description}`}
            >
              <img
                src={urlPhoto(photo.chemin)}
                alt=""
                className="w-full aspect-[4/3] object-cover border border-mf-border"
              />
            </button>
          ))}
        </div>
      )}

      {!proposable ? (
        <p className="text-xs text-mf-text-3 mt-3">À titre indicatif — aucune intervention proposée pour l'instant.</p>
      ) : decide ? (
        <div className="flex items-center justify-between gap-3 mt-3">
          <Badge tone={point.decision_client === "approuve" ? "emeraude" : "stone"}>
            {point.decision_client === "approuve" ? "Vous avez approuvé" : "Vous avez refusé"}
          </Badge>
          {/* Un clic de travers n'est plus définitif. La base acceptait déjà
              qu'on revienne sur une réponse ; l'écran, lui, faisait
              disparaître les boutons — un client qui refusait ses plaquettes
              de frein par erreur n'avait plus aucun moyen de corriger. */}
          <button
            type="button"
            onClick={() => onModifier(point.id)}
            className="text-sm font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px] px-1"
          >
            Modifier ma réponse
          </button>
        </div>
      ) : (
        <div className="flex gap-2 mt-3">
          {/* Le montant figure dans le bouton sur écran large : on sait à
              quoi on s'engage au moment où on appuie. Pas sur téléphone —
              dans un demi-bouton de 150 px, « Approuver · 289,95 $ » passait
              sur deux lignes et le bouton devenait plus haut que « Refuser ».
              Le prix est de toute façon écrit en haut de la même carte. */}
          <Bouton onClick={() => onRepondre(point.id, "approuve")} enEnvoi={enCours} className="flex-1">
            Approuver
            {point.prix_estime != null && <span className="hidden sm:inline">&nbsp;· {formatMoney(point.prix_estime)}</span>}
          </Bouton>
          <Bouton variante="secondaire" onClick={() => onRepondre(point.id, "refuse")} enEnvoi={enCours} className="flex-1">
            Refuser
          </Bouton>
        </div>
      )}
    </div>
  );
}
