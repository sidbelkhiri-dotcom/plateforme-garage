"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Car, Pencil, Trash2, DollarSign, Bookmark, RotateCcw, ImageOff } from "lucide-react";
import Modale from "@/components/ui/Modale";
import ModaleConfirmation from "@/components/ui/ModaleConfirmation";
import Bouton from "@/components/ui/Bouton";
import ChampRecherche from "@/components/ui/ChampRecherche";
import Tableau, { type ColonneTableau } from "@/components/ui/Tableau";
import Tabs from "@/components/ui/Tabs";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import FormulaireVehiculeStock from "@/components/forms/FormulaireVehiculeStock";
import FormulaireVenteVehiculeStock from "@/components/forms/FormulaireVenteVehiculeStock";
import { useProfil } from "@/lib/useProfil";
import { formatDateLong } from "@/lib/dates";
import { BUCKET_VEHICULES_STOCK, urlPhotoVehiculeStock } from "@/lib/vehiculesStockPhotos";
import Lightbox from "@/components/ui/Lightbox";

type Statut = "disponible" | "reserve" | "vendu";

type VehiculeStock = {
  id: string;
  marque: string;
  modele: string;
  annee: number | null;
  vin: string | null;
  plaque: string | null;
  couleur: string | null;
  kilometrage: number | null;
  cout_achat: number;
  prix_demande: number;
  statut: Statut;
  notes: string | null;
  vendu_le: string | null;
  prix_vente: number | null;
  acheteur_nom: string | null;
  acheteur_telephone: string | null;
  photos: string[];
};

const LABEL_STATUT: Record<Statut, string> = {
  disponible: "Disponible",
  reserve: "Réservé",
  vendu: "Vendu",
};

const TON_STATUT: Record<Statut, ToneBadge> = {
  disponible: "emeraude",
  reserve: "ambre",
  vendu: "ardoise",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function VehiculesStockPage() {
  const supabase = createClient();
  const { peutGererClients } = useProfil();
  const [items, setItems] = useState<VehiculeStock[]>([]);
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState("disponible");
  const [showAdd, setShowAdd] = useState(false);
  const [itemEnEdition, setItemEnEdition] = useState<VehiculeStock | null>(null);
  const [itemASupprimer, setItemASupprimer] = useState<VehiculeStock | null>(null);
  const [itemAVendre, setItemAVendre] = useState<VehiculeStock | null>(null);
  const [itemVenteAAnnuler, setItemVenteAAnnuler] = useState<VehiculeStock | null>(null);
  const [itemGalerie, setItemGalerie] = useState<VehiculeStock | null>(null);
  const [indexLightbox, setIndexLightbox] = useState<number | null>(null);

  const charger = useCallback(
    async (terme = "") => {
      setChargement(true);
      let requete = supabase.from("vehicules_stock").select("*").order("created_at", { ascending: false });
      if (onglet !== "tous") {
        requete = requete.eq("statut", onglet);
      }
      if (terme.trim()) {
        requete = requete.or(`marque.ilike.%${terme}%,modele.ilike.%${terme}%,vin.ilike.%${terme}%,plaque.ilike.%${terme}%`);
      }
      const { data } = await requete;
      // photos peut être absent tant que la migration
      // 2026-08-17_photos_vehicules_stock.sql n'a pas été appliquée —
      // normalisé ici pour que le reste du composant n'ait jamais à s'en
      // soucier.
      setItems((data ?? []).map((v) => ({ ...v, photos: v.photos ?? [] })));
      setChargement(false);
    },
    [supabase, onglet]
  );

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onglet]);

  async function changerStatut(id: string, statut: Statut) {
    await supabase.from("vehicules_stock").update({ statut }).eq("id", id);
    charger();
  }

  const colonnes: ColonneTableau<VehiculeStock>[] = [
    {
      cle: "photo",
      titre: "",
      rendu: (v) =>
        v.photos.length > 0 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setItemGalerie(v);
            }}
            className="block w-14 h-10 shrink-0"
            aria-label={`Voir les ${v.photos.length} photo(s)`}
          >
            <img
              src={urlPhotoVehiculeStock(supabase, v.photos[0])}
              alt=""
              className="w-14 h-10 object-cover rounded-mf-sm border border-mf-border"
            />
          </button>
        ) : (
          <span className="flex items-center justify-center w-14 h-10 rounded-mf-sm border border-dashed border-mf-border text-mf-text-3">
            <ImageOff className="w-4 h-4" />
          </span>
        ),
    },
    {
      cle: "vehicule",
      titre: "Véhicule",
      rendu: (v) => (
        <span className="font-medium">
          {v.marque} {v.modele} {v.annee ? `(${v.annee})` : ""}
        </span>
      ),
    },
    {
      cle: "identification",
      titre: "VIN / Plaque",
      rendu: (v) => [v.vin, v.plaque].filter(Boolean).join(" · ") || "—",
    },
    { cle: "cout_achat", titre: "Coût d'achat", rendu: (v) => formatMoney(v.cout_achat) },
    {
      cle: "prix",
      titre: "Prix",
      rendu: (v) =>
        v.statut === "vendu" ? (
          <span className="text-mf-success font-semibold">{formatMoney(v.prix_vente ?? 0)}</span>
        ) : (
          formatMoney(v.prix_demande)
        ),
    },
    {
      cle: "marge",
      titre: "Marge",
      rendu: (v) => (v.statut === "vendu" ? formatMoney((v.prix_vente ?? 0) - v.cout_achat) : "—"),
    },
    {
      cle: "acheteur",
      titre: "Acheteur",
      rendu: (v) =>
        v.statut === "vendu" ? (
          <span>
            {v.acheteur_nom || "—"}
            {v.vendu_le && <span className="text-mf-text-3"> · {formatDateLong(v.vendu_le)}</span>}
          </span>
        ) : (
          "—"
        ),
    },
    { cle: "statut", titre: "Statut", rendu: (v) => <Badge tone={TON_STATUT[v.statut]}>{LABEL_STATUT[v.statut]}</Badge> },
  ];

  if (peutGererClients) {
    colonnes.push({
      cle: "actions",
      titre: "",
      rendu: (v) => (
        <span className="flex items-center gap-1 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setItemEnEdition(v);
            }}
            className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center"
            aria-label="Modifier"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {v.statut === "disponible" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                changerStatut(v.id, "reserve");
              }}
              className="text-mf-text-3 hover:text-mf-warning w-11 h-11 flex items-center justify-center"
              aria-label="Réserver"
              title="Réserver"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          )}
          {v.statut === "reserve" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                changerStatut(v.id, "disponible");
              }}
              className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center"
              aria-label="Remettre disponible"
              title="Remettre disponible"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {v.statut !== "vendu" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setItemAVendre(v);
              }}
              className="text-mf-text-3 hover:text-mf-success w-11 h-11 flex items-center justify-center"
              aria-label="Marquer vendu"
              title="Marquer vendu"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          {v.statut === "vendu" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setItemVenteAAnnuler(v);
              }}
              className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center"
              aria-label="Annuler la vente"
              title="Annuler la vente"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setItemASupprimer(v);
            }}
            className="text-mf-text-3 hover:text-mf-red w-11 h-11 flex items-center justify-center"
            aria-label="Supprimer"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </span>
      ),
    });
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">Véhicules en stock</h1>
          <p className="text-sm text-mf-text-2">{items.length} véhicule(s)</p>
        </div>
        {peutGererClients && (
          <Bouton onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Nouveau véhicule
          </Bouton>
        )}
      </div>

      <div className="mb-4">
        <Tabs
          valeur={onglet}
          onChange={setOnglet}
          onglets={[
            { value: "disponible", label: "Disponible" },
            { value: "reserve", label: "Réservé" },
            { value: "vendu", label: "Vendu" },
            { value: "tous", label: "Tous" },
          ]}
        />
      </div>

      <div className="mb-4">
        <ChampRecherche placeholder="Marque, modèle, VIN, plaque..." onRecherche={charger} />
      </div>

      {chargement ? (
        <Chargement />
      ) : items.length === 0 ? (
        <EtatVide icone={Car} titre="Aucun véhicule" message="Ajoutez un premier véhicule en stock." />
      ) : (
        <Tableau colonnes={colonnes} lignes={items} />
      )}

      {showAdd && (
        <Modale titre="Nouveau véhicule" surFermeture={() => setShowAdd(false)}>
          <FormulaireVehiculeStock
            onSucces={() => {
              setShowAdd(false);
              charger();
            }}
            onAnnuler={() => setShowAdd(false)}
          />
        </Modale>
      )}

      {itemEnEdition && (
        <Modale titre="Modifier le véhicule" surFermeture={() => setItemEnEdition(null)}>
          <FormulaireVehiculeStock
            vehiculeId={itemEnEdition.id}
            valeursInitiales={{
              marque: itemEnEdition.marque,
              modele: itemEnEdition.modele,
              annee: itemEnEdition.annee != null ? String(itemEnEdition.annee) : "",
              vin: itemEnEdition.vin ?? "",
              plaque: itemEnEdition.plaque ?? "",
              couleur: itemEnEdition.couleur ?? "",
              kilometrage: itemEnEdition.kilometrage != null ? String(itemEnEdition.kilometrage) : "",
              cout_achat: String(itemEnEdition.cout_achat),
              prix_demande: String(itemEnEdition.prix_demande),
              notes: itemEnEdition.notes ?? "",
            }}
            photosInitiales={itemEnEdition.photos}
            onSucces={() => {
              setItemEnEdition(null);
              charger();
            }}
            onAnnuler={() => setItemEnEdition(null)}
          />
        </Modale>
      )}

      {itemGalerie && (
        <Modale
          large
          titre={`${itemGalerie.marque} ${itemGalerie.modele} — ${itemGalerie.photos.length} photo(s)`}
          surFermeture={() => setItemGalerie(null)}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {itemGalerie.photos.map((chemin, i) => (
              <button key={chemin} onClick={() => setIndexLightbox(i)} className="block" aria-label="Agrandir la photo">
                <img
                  src={urlPhotoVehiculeStock(supabase, chemin)}
                  alt=""
                  className="w-full aspect-[4/3] object-cover rounded-mf-sm border border-mf-border hover:opacity-80 transition-opacity"
                />
              </button>
            ))}
          </div>
        </Modale>
      )}

      {itemGalerie && indexLightbox !== null && (
        <Lightbox
          urls={itemGalerie.photos.map((chemin) => urlPhotoVehiculeStock(supabase, chemin))}
          index={indexLightbox}
          onIndexChange={setIndexLightbox}
          onFermer={() => setIndexLightbox(null)}
        />
      )}

      {itemAVendre && (
        <Modale
          titre={`Marquer vendu — ${itemAVendre.marque} ${itemAVendre.modele}`}
          surFermeture={() => setItemAVendre(null)}
        >
          <FormulaireVenteVehiculeStock
            vehiculeId={itemAVendre.id}
            prixDemande={itemAVendre.prix_demande}
            onSucces={() => {
              setItemAVendre(null);
              charger();
            }}
            onAnnuler={() => setItemAVendre(null)}
          />
        </Modale>
      )}

      {itemVenteAAnnuler && (
        <ModaleConfirmation
          titre="Annuler cette vente ?"
          message={`« ${itemVenteAAnnuler.marque} ${itemVenteAAnnuler.modele} » redevient disponible. Le prix de vente, l'acheteur et la date enregistrés seront effacés.`}
          libelleConfirmation="Annuler la vente"
          surConfirmation={async () => {
            const { error } = await supabase
              .from("vehicules_stock")
              .update({
                statut: "disponible",
                prix_vente: null,
                acheteur_nom: null,
                acheteur_telephone: null,
                vendu_le: null,
              })
              .eq("id", itemVenteAAnnuler.id);
            return { error: error?.message ?? null };
          }}
          surFermeture={() => {
            setItemVenteAAnnuler(null);
            charger();
          }}
        />
      )}

      {itemASupprimer && (
        <ModaleConfirmation
          titre="Supprimer ce véhicule ?"
          message={`« ${itemASupprimer.marque} ${itemASupprimer.modele} » sera supprimé du stock.`}
          surConfirmation={async () => {
            const { error } = await supabase.from("vehicules_stock").delete().eq("id", itemASupprimer.id);
            if (!error && itemASupprimer.photos.length > 0) {
              await supabase.storage.from(BUCKET_VEHICULES_STOCK).remove(itemASupprimer.photos);
            }
            return { error: error?.message ?? null };
          }}
          surFermeture={() => {
            setItemASupprimer(null);
            charger();
          }}
        />
      )}
    </div>
  );
}
