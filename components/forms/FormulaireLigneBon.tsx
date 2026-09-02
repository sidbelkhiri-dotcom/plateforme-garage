"use client";

import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useCategoriesPieces, usePieces } from "@/lib/usePieces";
import { useProfil } from "@/lib/useProfil";
import { todayLocal } from "@/lib/dates";
import { BUCKET_FACTURES_PIECES, urlSigneePhotoFacturePiece } from "@/lib/facturesPiecesPhotos";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

type PieceInventaire = { id: string; nom: string; quantite: number; prix: number };
const HORS_INVENTAIRE = "__hors_inventaire__";
const AUTRE = "__autre__";

export type TypeLigne = "piece" | "main_oeuvre";
export type EtatPiece = "neuve" | "usagee" | "reusinee" | "remise_a_neuf";

export const ETATS_PIECE: { value: EtatPiece; label: string }[] = [
  { value: "neuve", label: "Neuve" },
  { value: "usagee", label: "Usagée" },
  { value: "reusinee", label: "Réusinée" },
  { value: "remise_a_neuf", label: "Remise à neuf" },
];

type LigneValeurs = {
  description: string;
  quantite: string;
  prix_unitaire: string;
  etat_piece: EtatPiece;
  code_barre: string;
  installee_le: string;
  fournisseur: string;
};

// Une seule table pour pièce et main-d'œuvre, discriminée par `type`
// (D16) — mais deux formulaires différents, parce qu'une pièce a un état
// obligatoire et la main-d'œuvre n'en a pas.
export default function FormulaireLigneBon({
  bonTravailId,
  type,
  ligneId,
  pieceIdInitial,
  valeursInitiales,
  photosFactureInitiales,
  onSucces,
  onAnnuler,
}: {
  bonTravailId: string;
  type: TypeLigne;
  ligneId?: string;
  pieceIdInitial?: string | null;
  valeursInitiales?: Partial<LigneValeurs>;
  photosFactureInitiales?: string[];
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { profil } = useProfil();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<LigneValeurs>({
    description: "",
    quantite: type === "piece" ? "1" : "1",
    prix_unitaire: "0",
    etat_piece: "neuve",
    code_barre: "",
    installee_le: todayLocal(),
    fournisseur: "",
    ...valeursInitiales,
  });
  const [pieceId, setPieceId] = useState<string | null>(pieceIdInitial ?? null);
  const [pieces, setPieces] = useState<PieceInventaire[]>([]);
  const [photosFacture, setPhotosFacture] = useState<string[]>(photosFactureInitiales ?? []);
  const [enTeleversement, setEnTeleversement] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const [urlsPhotos, setUrlsPhotos] = useState<Record<string, string>>({});
  // Catalogue générique (catégorie -> pièce), pour une pièce hors inventaire
  // seulement — voir migration 2026-08-16_ref_pieces.sql. En modification,
  // on repart en saisie libre pour ne pas perdre une description déjà
  // enregistrée qui ne vient pas forcément du catalogue.
  const [descriptionLibre, setDescriptionLibre] = useState(Boolean(ligneId));
  const [categoriePiece, setCategoriePiece] = useState("");
  const categoriesPieces = useCategoriesPieces();
  const nomsPieces = usePieces(categoriePiece);

  // Le décrément automatique du stock (D33) ne se déclenche que pour les
  // lignes reliées à l'inventaire — sans ce menu, piece_id ne serait
  // jamais renseigné et le décrément resterait mort.
  useEffect(() => {
    if (type !== "piece") return;
    supabase
      .from("inventaire")
      .select("id, nom, quantite, prix")
      .order("nom")
      .then(({ data }) => setPieces(data ?? []));
  }, [type]);

  useEffect(() => {
    if (photosFacture.length === 0) return;
    let annule = false;
    Promise.all(
      photosFacture.map(async (chemin) => [chemin, await urlSigneePhotoFacturePiece(supabase, chemin)] as const)
    ).then((paires) => {
      if (annule) return;
      setUrlsPhotos(Object.fromEntries(paires.filter((p): p is [string, string] => p[1] !== null)));
    });
    return () => {
      annule = true;
    };
  }, [photosFacture]);

  async function ajouterPhotosFacture(fichiers: FileList | null) {
    if (!fichiers || fichiers.length === 0) return;
    setEnTeleversement(true);
    setErreurPhoto(null);
    const nouveauxChemins: string[] = [];
    for (const fichier of Array.from(fichiers)) {
      // Préfixe garage_id — voir FormulaireVehiculeStock.tsx pour la
      // même logique côté RLS Storage.
      const chemin = `${profil?.garage_id}/${crypto.randomUUID()}-${fichier.name}`;
      const { error } = await supabase.storage.from(BUCKET_FACTURES_PIECES).upload(chemin, fichier);
      if (error) {
        setErreurPhoto(error.message);
        continue;
      }
      nouveauxChemins.push(chemin);
    }
    setPhotosFacture((p) => [...p, ...nouveauxChemins]);
    setEnTeleversement(false);
  }

  async function supprimerPhotoFacture(chemin: string) {
    setPhotosFacture((p) => p.filter((c) => c !== chemin));
    await supabase.storage.from(BUCKET_FACTURES_PIECES).remove([chemin]);
  }

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      bon_travail_id: bonTravailId,
      type,
      description: valeurs.description.trim(),
      quantite: Number(valeurs.quantite) || 1,
      prix_unitaire: Number(valeurs.prix_unitaire) || 0,
      etat_piece: type === "piece" ? valeurs.etat_piece : null,
      piece_id: type === "piece" ? pieceId : null,
      code_barre: type === "piece" ? valeurs.code_barre.trim() || null : null,
      installee_le: type === "piece" ? valeurs.installee_le : null,
      fournisseur: type === "piece" ? valeurs.fournisseur.trim() || null : null,
      photos_facture: type === "piece" ? photosFacture : [],
    };
    const reussi = await soumettre(async () =>
      ligneId
        ? await supabase.from("bon_travail_lignes").update(donnees).eq("id", ligneId)
        : await supabase.from("bon_travail_lignes").insert(donnees)
    );
    if (reussi) onSucces();
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      {type === "piece" && (
        <div>
          <Selecteur
            label="Pièce en inventaire"
            value={pieceId ?? HORS_INVENTAIRE}
            onChange={(e) => {
              if (e.target.value === HORS_INVENTAIRE) {
                setPieceId(null);
                return;
              }
              const p = pieces.find((x) => x.id === e.target.value);
              setPieceId(e.target.value);
              if (p) {
                definir("description", p.nom);
                definir("prix_unitaire", String(p.prix));
              }
            }}
          >
            <option value={HORS_INVENTAIRE}>— Pièce hors inventaire —</option>
            {pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom} ({p.quantite} en stock)
              </option>
            ))}
          </Selecteur>
          <p className="text-xs text-mf-text-3 mt-1">
            {pieceId
              ? "Reliée à ton stock — la quantité sera déduite automatiquement à la fin des travaux."
              : "Si cette pièce vient de ton propre stock, choisis-la ici pour que la quantité en soit déduite automatiquement. Sinon, laisse « hors inventaire »."}
          </p>
        </div>
      )}

      {type === "piece" && !pieceId && !descriptionLibre ? (
        <>
          <Selecteur
            label="Catégorie de pièce"
            value={categoriePiece}
            onChange={(e) => {
              setCategoriePiece(e.target.value);
              definir("description", "");
            }}
          >
            <option value="">— Choisir —</option>
            {categoriesPieces.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Selecteur>
          <Selecteur
            label="Description"
            required
            value={valeurs.description}
            disabled={!categoriePiece}
            onChange={(e) => {
              if (e.target.value === AUTRE) {
                setDescriptionLibre(true);
                definir("description", "");
              } else {
                definir("description", e.target.value);
              }
            }}
          >
            <option value="">{categoriePiece ? "— Choisir —" : "— Choisir une catégorie d'abord —"}</option>
            {nomsPieces.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            <option value={AUTRE}>Autre (préciser)…</option>
          </Selecteur>
        </>
      ) : (
        <Champ
          label="Description"
          required
          placeholder={type === "piece" ? "Ex. plaquettes de frein avant" : "Ex. diagnostic, remplacement freins"}
          value={valeurs.description}
          onChange={(e) => definir("description", e.target.value)}
        />
      )}

      {type === "piece" && (
        <Selecteur
          label="État de la pièce"
          required
          value={valeurs.etat_piece}
          onChange={(e) => definir("etat_piece", e.target.value as EtatPiece)}
        >
          {ETATS_PIECE.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </Selecteur>
      )}

      {type === "piece" && (
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Code-barres"
            placeholder="Scanner ou saisir..."
            value={valeurs.code_barre}
            onChange={(e) => definir("code_barre", e.target.value)}
          />
          <Champ
            label="Date d'installation"
            type="date"
            required
            value={valeurs.installee_le}
            onChange={(e) => definir("installee_le", e.target.value)}
          />
        </div>
      )}

      {type === "piece" && (
        <div className="flex flex-col gap-2">
          <Champ
            label="Fournisseur"
            placeholder="Ex. NAPA, PartSource..."
            value={valeurs.fournisseur}
            onChange={(e) => definir("fournisseur", e.target.value)}
          />
          <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">
            Photo de la facture
          </span>
          <p className="text-xs text-mf-text-3 -mt-1">
            Gardée pour une réclamation de garantie auprès du fournisseur.
          </p>
          <div className="flex flex-wrap gap-2">
            {photosFacture.map((chemin) => (
              <div key={chemin} className="relative w-20 h-16 shrink-0">
                {urlsPhotos[chemin] ? (
                  <a href={urlsPhotos[chemin]} target="_blank" rel="noopener noreferrer">
                    <img
                      src={urlsPhotos[chemin]}
                      alt=""
                      className="w-full h-full object-cover rounded-mf-sm border border-mf-border"
                    />
                  </a>
                ) : (
                  <div className="w-full h-full rounded-mf-sm border border-mf-border bg-mf-surface-3" />
                )}
                <button
                  type="button"
                  onClick={() => supprimerPhotoFacture(chemin)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-mf-red text-white"
                  aria-label="Retirer cette photo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <label className="w-20 h-16 shrink-0 flex flex-col items-center justify-center gap-1 border border-dashed border-mf-border-strong rounded-mf-sm text-mf-text-3 hover:text-mf-text hover:border-mf-blue cursor-pointer text-[10px] text-center">
              <Camera className="w-4 h-4" />
              {enTeleversement ? "…" : "Photo"}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                disabled={enTeleversement}
                onChange={(e) => ajouterPhotosFacture(e.target.files)}
                className="hidden"
              />
            </label>
          </div>
          {erreurPhoto && <MessageErreur>{erreurPhoto}</MessageErreur>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Champ
          label={type === "piece" ? "Quantité" : "Heures"}
          type="number"
          step="0.25"
          required
          value={valeurs.quantite}
          onChange={(e) => definir("quantite", e.target.value)}
        />
        <Champ
          label={type === "piece" ? "Prix unitaire" : "Taux horaire"}
          type="number"
          step="0.01"
          required
          value={valeurs.prix_unitaire}
          onChange={(e) => definir("prix_unitaire", e.target.value)}
        />
      </div>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-1">
        <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton type="submit" enEnvoi={enEnvoi}>
          {ligneId ? "Enregistrer" : "Ajouter"}
        </Bouton>
      </div>
    </form>
  );
}
