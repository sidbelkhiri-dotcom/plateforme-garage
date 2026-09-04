"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, Copy, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useProfil } from "@/lib/useProfil";
import { useToast } from "@/components/ui/ToastProvider";
import { urlPubliquePhotoInspection } from "@/lib/inspectionPhotos";
import Bouton from "@/components/ui/Bouton";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import MessageErreur from "@/components/ui/MessageErreur";

type EtatPoint = "bon" | "a_surveiller" | "a_reparer";
type DecisionClient = "approuve" | "refuse" | null;
type StatutInspection = "brouillon" | "envoyee" | "consultee" | "repondue";

type Photo = { id: string; identifiant_public: string; chemin: string };
type Point = {
  id: string;
  description: string;
  etat: EtatPoint;
  recommandation: string | null;
  prix_estime: number | null;
  decision_client: DecisionClient;
  repondu_le: string | null;
  ordre: number;
  importe_le: string | null;
  inspection_photos: Photo[];
};
type Inspection = { id: string; statut: StatutInspection; jeton_acces: string; envoyee_le: string | null };

const TON_ETAT: Record<EtatPoint, ToneBadge> = { bon: "emeraude", a_surveiller: "ambre", a_reparer: "rouge" };
const LABEL_ETAT: Record<EtatPoint, string> = { bon: "Bon", a_surveiller: "À surveiller", a_reparer: "À réparer" };
const LABEL_STATUT_INSPECTION: Record<StatutInspection, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  consultee: "Consultée",
  repondue: "Répondue",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function InspectionClient({
  bon,
  client,
  vehicule,
  inspectionInitiale,
  pointsInitiaux,
}: {
  bon: { id: string; numero: string; plainte_client: string };
  client: { nom: string; email: string | null } | null;
  vehicule: { marque: string; modele: string; annee: number | null } | null;
  inspectionInitiale: Inspection | null;
  pointsInitiaux: Point[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const { profil } = useProfil();
  const { afficher } = useToast();

  const [inspection, setInspection] = useState(inspectionInitiale);
  const [points, setPoints] = useState(pointsInitiaux);
  const [creationEnCours, setCreationEnCours] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);

  // Le personnel voit apparaître la décision du client en direct, sans
  // recharger — même mécanisme que useDemandesRendezVous.
  useEffect(() => {
    if (!inspection) return;
    const canal = supabase
      .channel(`inspection_points_${inspection.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inspection_points", filter: `inspection_id=eq.${inspection.id}` },
        (payload: any) => {
          setPoints((pts) => pts.map((p) => (p.id === payload.new.id ? { ...p, ...payload.new } : p)));
          if (payload.new.decision_client) {
            afficher({
              titre: payload.new.decision_client === "approuve" ? "Point approuvé" : "Point refusé",
              description: payload.new.description,
              severite: payload.new.decision_client === "approuve" ? "success" : "warning",
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection?.id]);

  async function creerInspection() {
    setCreationEnCours(true);
    const expireLe = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("inspections")
      .insert({ bon_travail_id: bon.id, expire_le: expireLe })
      .select()
      .single();
    setCreationEnCours(false);
    if (error) {
      afficher({ titre: "Impossible de créer l'inspection", description: error.message, severite: "danger" });
      return;
    }
    setInspection(data);
  }

  async function envoyerAuClient() {
    if (!inspection) return;
    setEnvoiEnCours(true);
    try {
      const res = await fetch("/api/envoyer-inspection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId: inspection.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue.");
      setInspection((i) =>
        i ? { ...i, statut: i.statut === "brouillon" ? "envoyee" : i.statut, envoyee_le: new Date().toISOString() } : i
      );
      afficher({ titre: "Lien envoyé", description: `Envoyé à ${data.envoyeeA}`, severite: "success" });
      const echecSms = (data.resultats as { canal: string; ok: boolean; erreur?: string }[] | undefined)?.find(
        (r) => r.canal === "sms" && !r.ok
      );
      if (echecSms) {
        afficher({ titre: "Texto non envoyé", description: echecSms.erreur, severite: "warning" });
      }
    } catch (e) {
      afficher({ titre: "Impossible d'envoyer", description: (e as Error).message, severite: "danger" });
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function supprimerPoint(id: string) {
    setPoints((pts) => pts.filter((p) => p.id !== id));
    await supabase.from("inspection_points").delete().eq("id", id);
  }

  async function ajouterPhotos(pointId: string, fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    for (const fichier of Array.from(fichiers)) {
      // Le nom d'origine peut contenir des caractères refusés par
      // Supabase Storage (accents, apostrophes, virgules — ex. captures
      // d'écran macOS "Capture d'écran, le ..."), d'où "Invalid key" à
      // l'upload. On ne garde que l'extension, jamais le nom complet.
      const extension = fichier.name.includes(".") ? fichier.name.split(".").pop() : "";
      const chemin = `${profil?.garage_id}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
      const { error: erreurUpload } = await supabase.storage.from("inspection-photos").upload(chemin, fichier);
      if (erreurUpload) {
        afficher({ titre: "Téléversement échoué", description: erreurUpload.message, severite: "danger" });
        continue;
      }
      const { data, error } = await supabase
        .from("inspection_photos")
        .insert({ inspection_point_id: pointId, chemin, type: "photo" })
        .select()
        .single();
      if (error) {
        afficher({ titre: "Impossible d'enregistrer la photo", description: error.message, severite: "danger" });
        continue;
      }
      setPoints((pts) => pts.map((p) => (p.id === pointId ? { ...p, inspection_photos: [...p.inspection_photos, data] } : p)));
    }
  }

  async function supprimerPhoto(pointId: string, photo: Photo) {
    setPoints((pts) =>
      pts.map((p) => (p.id === pointId ? { ...p, inspection_photos: p.inspection_photos.filter((ph) => ph.id !== photo.id) } : p))
    );
    await supabase.storage.from("inspection-photos").remove([photo.chemin]);
    await supabase.from("inspection_photos").delete().eq("id", photo.id);
  }

  async function importerVersLeBon(point: Point) {
    const description = point.recommandation ? `${point.description} — ${point.recommandation}` : point.description;
    const { error } = await supabase.from("bon_travail_lignes").insert({
      bon_travail_id: bon.id,
      type: "main_oeuvre",
      description,
      quantite: 1,
      prix_unitaire: point.prix_estime ?? 0,
    });
    if (error) {
      afficher({ titre: "Import échoué", description: error.message, severite: "danger" });
      return;
    }
    const importeLe = new Date().toISOString();
    await supabase.from("inspection_points").update({ importe_le: importeLe }).eq("id", point.id);
    setPoints((pts) => pts.map((p) => (p.id === point.id ? { ...p, importe_le: importeLe } : p)));
    afficher({ titre: "Ajouté au bon de travail", description: "Ligne de brouillon créée dans « Main-d'œuvre ».", severite: "success" });
  }

  function copierLien() {
    if (!inspection) return;
    const url = `${window.location.origin}/inspection/${inspection.jeton_acces}`;
    navigator.clipboard.writeText(url);
    afficher({ titre: "Lien copié", severite: "success" });
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <button
        onClick={() => router.push(`/bons-travail/${bon.id}`)}
        className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Retour au bon de travail
      </button>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-black font-mono tracking-wide text-mf-text">Inspection — {bon.numero}</h1>
          {inspection && <Badge tone="ardoise">{LABEL_STATUT_INSPECTION[inspection.statut]}</Badge>}
        </div>
        <p className="text-sm text-mf-text-2 mt-1">
          {vehicule ? `${vehicule.marque} ${vehicule.modele}${vehicule.annee ? ` (${vehicule.annee})` : ""}` : ""}
          {client ? ` · ${client.nom}` : ""}
        </p>
      </div>

      {!inspection ? (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-8 text-center">
          <p className="text-sm text-mf-text-2 mb-4">
            Aucune inspection pour ce bon de travail. Photographie chaque point relevé, puis envoie le lien au
            client pour qu'il approuve ou refuse chaque réparation proposée.
          </p>
          <Bouton onClick={creerInspection} enEnvoi={creationEnCours}>
            Créer une inspection
          </Bouton>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <Bouton variante="secondaire" onClick={() => setAjoutOuvert(true)}>
              <Plus className="w-4 h-4" /> Ajouter un point
            </Bouton>
            <div className="flex items-center gap-2">
              {inspection.statut !== "brouillon" && (
                <button
                  onClick={copierLien}
                  className="flex items-center gap-1.5 text-xs font-semibold text-mf-text-2 hover:text-mf-text min-h-[44px]"
                >
                  <Copy className="w-3.5 h-3.5" /> Copier le lien
                </button>
              )}
              <Bouton onClick={envoyerAuClient} enEnvoi={envoiEnCours} disabled={points.length === 0 || !client?.email}>
                {inspection.statut === "brouillon" ? "Envoyer au client" : "Renvoyer au client"}
              </Bouton>
            </div>
          </div>
          {!client?.email && (
            <p className="text-xs text-mf-warning mb-4">
              Ce client n'a pas d'adresse courriel enregistrée — ajoute-en une sur sa fiche pour pouvoir envoyer le lien.
            </p>
          )}

          {points.length === 0 ? (
            <div className="bg-mf-surface rounded-mf-md border border-mf-border p-8 text-center text-sm text-mf-text-2">
              Aucun point ajouté pour l'instant.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {points.map((point) => (
                <PointCard
                  key={point.id}
                  point={point}
                  supabase={supabase}
                  onSupprimer={() => supprimerPoint(point.id)}
                  onAjouterPhotos={(f) => ajouterPhotos(point.id, f)}
                  onSupprimerPhoto={(photo) => supprimerPhoto(point.id, photo)}
                  onImporter={() => importerVersLeBon(point)}
                />
              ))}
            </div>
          )}

          {ajoutOuvert && (
            <FormulaireAjoutPoint
              inspectionId={inspection.id}
              ordreSuivant={points.length}
              onAnnuler={() => setAjoutOuvert(false)}
              onCree={(point) => {
                setPoints((pts) => [...pts, point]);
                setAjoutOuvert(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function PointCard({
  point,
  supabase,
  onSupprimer,
  onAjouterPhotos,
  onSupprimerPhoto,
  onImporter,
}: {
  point: Point;
  supabase: any;
  onSupprimer: () => void;
  onAjouterPhotos: (fichiers: FileList | null) => void;
  onSupprimerPhoto: (photo: Photo) => void;
  onImporter: () => void;
}) {
  return (
    <div className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={TON_ETAT[point.etat]}>{LABEL_ETAT[point.etat]}</Badge>
            {point.decision_client === "approuve" && <Badge tone="emeraude">Approuvé par le client</Badge>}
            {point.decision_client === "refuse" && <Badge tone="rouge">Refusé par le client</Badge>}
            {point.importe_le && <Badge tone="ardoise">Ajouté au bon</Badge>}
          </div>
          <div className="text-sm text-mf-text font-medium mt-1.5">{point.description}</div>
          {point.recommandation && <div className="text-sm text-mf-text-2 mt-0.5">{point.recommandation}</div>}
          {point.prix_estime != null && (
            <div className="text-sm text-mf-text-3 mt-0.5">Prix estimé : {formatMoney(point.prix_estime)}</div>
          )}
        </div>
        <button
          onClick={onSupprimer}
          className="text-mf-text-3 hover:text-mf-red w-11 h-11 -mr-2 -mt-2 flex items-center justify-center rounded-mf-sm"
          aria-label="Supprimer ce point"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {point.inspection_photos.map((photo) => (
          <div key={photo.id} className="relative w-20 h-16 shrink-0">
            <img
              src={urlPubliquePhotoInspection(supabase, photo.chemin)}
              alt=""
              className="w-full h-full object-cover rounded-mf-sm border border-mf-border"
            />
            <button
              onClick={() => onSupprimerPhoto(photo)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-mf-red text-white"
              aria-label="Retirer cette photo"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="w-20 h-16 shrink-0 flex flex-col items-center justify-center gap-1 border border-dashed border-mf-border-strong rounded-mf-sm text-mf-text-3 hover:text-mf-text hover:border-mf-blue cursor-pointer text-[10px] text-center">
          <Camera className="w-4 h-4" />
          Photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) => onAjouterPhotos(e.target.files)}
            className="hidden"
          />
        </label>
      </div>

      {point.decision_client === "approuve" && !point.importe_le && (
        <Bouton variante="secondaire" onClick={onImporter} className="mt-3">
          <Check className="w-4 h-4" /> Ajouter au bon de travail
        </Bouton>
      )}
    </div>
  );
}

function FormulaireAjoutPoint({
  inspectionId,
  ordreSuivant,
  onAnnuler,
  onCree,
}: {
  inspectionId: string;
  ordreSuivant: number;
  onAnnuler: () => void;
  onCree: (point: Point) => void;
}) {
  const supabase = createClient();
  const [description, setDescription] = useState("");
  const [etat, setEtat] = useState<EtatPoint>("a_surveiller");
  const [recommandation, setRecommandation] = useState("");
  const [prixEstime, setPrixEstime] = useState("");
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    setEnEnvoi(true);
    setErreur(null);
    const { data, error } = await supabase
      .from("inspection_points")
      .insert({
        inspection_id: inspectionId,
        description: description.trim(),
        etat,
        recommandation: recommandation.trim() || null,
        prix_estime: prixEstime ? Number(prixEstime) : null,
        ordre: ordreSuivant,
      })
      .select()
      .single();
    setEnEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    onCree({ ...data, inspection_photos: [] });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--mf-overlay)] backdrop-blur-sm p-4">
      <div className="bg-mf-surface-2 rounded-mf-lg border border-mf-border shadow-mf-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-mf-border">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide text-mf-text">Ajouter un point</h2>
          <button
            onClick={onAnnuler}
            className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center -mr-2 rounded-mf-sm"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={envoyer} className="p-5 flex flex-col gap-3">
          <Champ
            label="Description"
            required
            placeholder="Ex. plaquettes de frein avant usées à 20%"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Selecteur label="État" value={etat} onChange={(e) => setEtat(e.target.value as EtatPoint)}>
            <option value="bon">Bon</option>
            <option value="a_surveiller">À surveiller</option>
            <option value="a_reparer">À réparer</option>
          </Selecteur>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">Recommandation</span>
            <textarea
              rows={2}
              placeholder="Ce que tu recommandes au client..."
              value={recommandation}
              onChange={(e) => setRecommandation(e.target.value)}
              className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft"
            />
          </label>
          <Champ
            label="Prix estimé"
            type="number"
            step="0.01"
            placeholder="Optionnel"
            value={prixEstime}
            onChange={(e) => setPrixEstime(e.target.value)}
          />
          {erreur && <MessageErreur>{erreur}</MessageErreur>}
          <div className="flex justify-end gap-2 mt-1">
            <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
              Annuler
            </Bouton>
            <Bouton type="submit" enEnvoi={enEnvoi}>
              Ajouter
            </Bouton>
          </div>
        </form>
      </div>
    </div>
  );
}
