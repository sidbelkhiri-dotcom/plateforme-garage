"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";
import Selecteur from "@/components/ui/Selecteur";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Tableau, { type ColonneTableau } from "@/components/ui/Tableau";
import { formatDateHeure } from "@/lib/dates";

type Statut = "actif" | "suspendu" | "resilie";

type Garage = {
  id: string;
  nom: string;
  statut: Statut;
  compteur_bt: number;
  compteur_fa: number;
  cree_le: string;
};

const TON_STATUT: Record<Statut, ToneBadge> = {
  actif: "emeraude",
  suspendu: "ambre",
  resilie: "rouge",
};

const LABEL_STATUT: Record<Statut, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  resilie: "Résilié",
};

// Console super-admin plateforme (/admin/garages) : voir tous les
// garages et changer leur statut. La création d'un garage reste
// manuelle en SQL pour l'instant — l'onboarding self-service est une
// étape ultérieure du plan.
export default function GaragesClient({ garagesInitial }: { garagesInitial: Garage[] }) {
  const supabase = createClient();
  const { afficher } = useToast();
  const [garages, setGarages] = useState(garagesInitial);
  const [enCours, setEnCours] = useState<string | null>(null);

  async function changerStatut(garage: Garage, statut: Statut) {
    setEnCours(garage.id);
    const { error } = await supabase.from("garages").update({ statut }).eq("id", garage.id);
    setEnCours(null);
    if (error) {
      afficher({ titre: "Échec", description: error.message, severite: "danger" });
      return;
    }
    setGarages((g) => g.map((x) => (x.id === garage.id ? { ...x, statut } : x)));
    afficher({ titre: `${garage.nom} → ${LABEL_STATUT[statut]}`, severite: "success" });
  }

  const colonnes: ColonneTableau<Garage>[] = [
    { cle: "nom", titre: "Garage" },
    {
      cle: "statut",
      titre: "Statut",
      rendu: (g) => <Badge tone={TON_STATUT[g.statut]}>{LABEL_STATUT[g.statut]}</Badge>,
    },
    {
      cle: "compteur_bt",
      titre: "Bons de travail",
      rendu: (g) => <span className="font-mono">{g.compteur_bt}</span>,
    },
    {
      cle: "compteur_fa",
      titre: "Factures",
      rendu: (g) => <span className="font-mono">{g.compteur_fa}</span>,
    },
    {
      cle: "cree_le",
      titre: "Créé le",
      rendu: (g) => <span className="text-mf-text-3">{formatDateHeure(g.cree_le)}</span>,
    },
    {
      cle: "actions",
      titre: "Changer le statut",
      rendu: (g) => (
        <div className="w-40">
          <Selecteur
            label=""
            value={g.statut}
            disabled={enCours === g.id}
            onChange={(e) => changerStatut(g, e.target.value as Statut)}
          >
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="resilie">Résilié</option>
          </Selecteur>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="flex items-center gap-2 text-xl font-display font-black uppercase tracking-wide text-mf-text">
          <Building2 className="w-5 h-5" /> Garages
        </h1>
        <p className="text-sm text-mf-text-2">{garages.length} garage(s) sur la plateforme</p>
      </div>

      <Tableau colonnes={colonnes} lignes={garages} />
    </div>
  );
}
