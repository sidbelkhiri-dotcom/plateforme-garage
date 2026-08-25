"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Package, AlertTriangle, Pencil, Trash2 } from "lucide-react";
import Modale from "@/components/ui/Modale";
import ModaleConfirmation from "@/components/ui/ModaleConfirmation";
import Bouton from "@/components/ui/Bouton";
import ChampRecherche from "@/components/ui/ChampRecherche";
import Tableau, { type ColonneTableau } from "@/components/ui/Tableau";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import FormulaireInventaire from "@/components/forms/FormulaireInventaire";
import { useProfil } from "@/lib/useProfil";

type Item = {
  id: string;
  reference: string | null;
  nom: string;
  quantite: number;
  seuil: number;
  prix_achat: number;
  prix: number;
  fournisseur: string | null;
  stock_bas: boolean;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function InventairePage() {
  const supabase = createClient();
  const { peutGererClients } = useProfil();
  const [items, setItems] = useState<Item[]>([]);
  const [chargement, setChargement] = useState(true);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [itemEnEdition, setItemEnEdition] = useState<Item | null>(null);
  const [itemASupprimer, setItemASupprimer] = useState<Item | null>(null);

  const charger = useCallback(
    async (terme = "") => {
      setChargement(true);
      let requete = supabase.from("inventaire").select("*").order("nom");
      if (terme.trim()) {
        requete = requete.or(`nom.ilike.%${terme}%,reference.ilike.%${terme}%,fournisseur.ilike.%${terme}%`);
      }
      const { data } = await requete;
      setItems(data ?? []);
      setChargement(false);
    },
    [supabase]
  );

  useEffect(() => {
    charger();
  }, [charger]);

  const stockBasCount = items.filter((i) => i.stock_bas).length;

  const colonnes: ColonneTableau<Item>[] = [
    { cle: "nom", titre: "Nom" },
    { cle: "reference", titre: "Référence", rendu: (i) => i.reference ?? "—" },
    {
      cle: "quantite",
      titre: "Stock",
      rendu: (i) => (
        <span className={i.stock_bas ? "text-mf-red font-semibold flex items-center gap-1 justify-end md:justify-start" : ""}>
          {i.stock_bas && <AlertTriangle className="w-3.5 h-3.5" />}
          {i.quantite} / seuil {i.seuil}
        </span>
      ),
    },
    { cle: "prix_achat", titre: "Prix d'achat", rendu: (i) => formatMoney(i.prix_achat) },
    { cle: "prix", titre: "Prix de vente", rendu: (i) => formatMoney(i.prix) },
    { cle: "fournisseur", titre: "Fournisseur", rendu: (i) => i.fournisseur ?? "—" },
  ];

  if (peutGererClients) {
    colonnes.push({
      cle: "actions",
      titre: "",
      rendu: (i) => (
        <span className="flex items-center gap-1 justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setItemEnEdition(i);
            }}
            className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center"
            aria-label="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setItemASupprimer(i);
            }}
            className="text-mf-text-3 hover:text-mf-red w-11 h-11 flex items-center justify-center"
            aria-label="Supprimer"
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
          <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">Inventaire</h1>
          <p className="text-sm text-mf-text-2">
            {items.length} pièce(s)
            {stockBasCount > 0 && <span className="text-mf-red font-semibold"> · {stockBasCount} en stock bas</span>}
          </p>
        </div>
        {peutGererClients && (
          <Bouton onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Nouvelle pièce
          </Bouton>
        )}
      </div>

      <div className="mb-4">
        <ChampRecherche placeholder="Nom, référence, fournisseur..." onRecherche={charger} />
      </div>

      {chargement ? (
        <Chargement />
      ) : items.length === 0 ? (
        <EtatVide icone={Package} titre="Aucune pièce" message="Ajoutez une première pièce à l'inventaire." />
      ) : (
        <Tableau colonnes={colonnes} lignes={items} />
      )}

      {showAdd && (
        <Modale titre="Nouvelle pièce" surFermeture={() => setShowAdd(false)}>
          <FormulaireInventaire
            onSucces={() => {
              setShowAdd(false);
              charger();
            }}
            onAnnuler={() => setShowAdd(false)}
          />
        </Modale>
      )}

      {itemEnEdition && (
        <Modale titre="Modifier la pièce" surFermeture={() => setItemEnEdition(null)}>
          <FormulaireInventaire
            itemId={itemEnEdition.id}
            valeursInitiales={{
              reference: itemEnEdition.reference ?? "",
              nom: itemEnEdition.nom,
              quantite: String(itemEnEdition.quantite),
              seuil: String(itemEnEdition.seuil),
              prix_achat: String(itemEnEdition.prix_achat),
              prix: String(itemEnEdition.prix),
              fournisseur: itemEnEdition.fournisseur ?? "",
            }}
            onSucces={() => {
              setItemEnEdition(null);
              charger();
            }}
            onAnnuler={() => setItemEnEdition(null)}
          />
        </Modale>
      )}

      {itemASupprimer && (
        <ModaleConfirmation
          titre="Supprimer cette pièce ?"
          message={`« ${itemASupprimer.nom} » sera supprimée de l'inventaire.`}
          surConfirmation={async () => {
            const { error } = await supabase.from("inventaire").delete().eq("id", itemASupprimer.id);
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
