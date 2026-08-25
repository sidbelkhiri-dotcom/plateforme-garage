"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Users, Phone, Car } from "lucide-react";
import Modale from "@/components/ui/Modale";
import Bouton from "@/components/ui/Bouton";
import ChampRecherche from "@/components/ui/ChampRecherche";
import Tableau, { type ColonneTableau } from "@/components/ui/Tableau";
import EtatVide from "@/components/ui/EtatVide";
import Chargement from "@/components/ui/Chargement";
import FormulaireClient from "@/components/forms/FormulaireClient";
import { useProfil } from "@/lib/useProfil";

type ClientRow = {
  id: string;
  nom: string;
  telephone: string | null;
  vehicule_count: number;
  vehicule_correspondant: string | null;
};

// Filtre PostgREST .or() : virgules et parenthèses casseraient la syntaxe.
function nettoyerTerme(terme: string) {
  return terme.replace(/[,()]/g, " ").trim();
}

export default function ClientsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { peutGererClients } = useProfil();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [chargement, setChargement] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [rechercheActive, setRechercheActive] = useState(false);

  const charger = useCallback(
    async (terme: string) => {
      setChargement(true);
      const t = nettoyerTerme(terme);
      setRechercheActive(!!t);

      if (!t) {
        const { data } = await supabase.from("clients").select("*, vehicules(count)").order("nom");
        setClients(vers(data));
        setChargement(false);
        return;
      }

      // Recherche globale (3.5) : nom/téléphone directement, ou
      // plaque/VIN/marque/modèle d'un véhicule qui remonte à son client —
      // le véhicule trouvé est affiché dans les résultats pour que le
      // personnel voie tout de suite ce qui a matché.
      const [{ data: parClient }, { data: vehiculesTrouves }] = await Promise.all([
        supabase
          .from("clients")
          .select("*, vehicules(count)")
          .or(`nom.ilike.%${t}%,telephone.ilike.%${t}%`)
          .order("nom"),
        supabase
          .from("vehicules")
          .select("client_id, marque, modele, annee, plaque")
          .or(`plaque.ilike.%${t}%,vin.ilike.%${t}%,marque.ilike.%${t}%,modele.ilike.%${t}%`),
      ]);

      const libelleVehicule = (v: { marque: string; modele: string | null; annee: number | null; plaque: string | null }) =>
        [`${v.marque} ${v.modele ?? ""}`.trim() + (v.annee ? ` (${v.annee})` : ""), v.plaque].filter(Boolean).join(" · ");

      const vehiculeParClient = new Map<string, string>();
      (vehiculesTrouves ?? []).forEach((v) => {
        if (!vehiculeParClient.has(v.client_id)) vehiculeParClient.set(v.client_id, libelleVehicule(v));
      });

      const idsParVehicule = Array.from(vehiculeParClient.keys());
      let clientsParVehicule: any[] = [];
      if (idsParVehicule.length > 0) {
        const { data } = await supabase
          .from("clients")
          .select("*, vehicules(count)")
          .in("id", idsParVehicule);
        clientsParVehicule = data ?? [];
      }

      const fusion = new Map<string, any>();
      [...(parClient ?? []), ...clientsParVehicule].forEach((c) => fusion.set(c.id, c));
      setClients(
        Array.from(fusion.values())
          .map((c) => versUnClient(c, vehiculeParClient.get(c.id) ?? null))
          .sort((a, b) => a.nom.localeCompare(b.nom))
      );
      setChargement(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    charger("");
  }, [charger]);

  const colonnes: ColonneTableau<ClientRow>[] = [
    { cle: "nom", titre: "Nom" },
    {
      cle: "telephone",
      titre: "Téléphone",
      rendu: (c) =>
        c.telephone ? (
          <span className="flex items-center gap-1.5 justify-end md:justify-start">
            <Phone className="w-3.5 h-3.5 text-mf-text-3" /> {c.telephone}
          </span>
        ) : (
          "—"
        ),
    },
    {
      cle: "vehicule_count",
      titre: "Véhicules",
      rendu: (c) => (
        <span className="flex items-center gap-1.5 justify-end md:justify-start">
          <Car className="w-3.5 h-3.5 text-mf-text-3" /> {c.vehicule_count}
        </span>
      ),
    },
    ...(rechercheActive
      ? [
          {
            cle: "vehicule_correspondant" as const,
            titre: "Véhicule trouvé",
            rendu: (c: ClientRow) =>
              c.vehicule_correspondant ? (
                <span className="text-mf-blue-hover">{c.vehicule_correspondant}</span>
              ) : (
                <span className="text-mf-text-3">—</span>
              ),
          },
        ]
      : []),
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">Clients</h1>
          <p className="text-sm text-mf-text-2">{clients.length} client(s)</p>
        </div>
        {peutGererClients && (
          <Bouton onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4" /> Nouveau client
          </Bouton>
        )}
      </div>

      <div className="mb-4">
        <ChampRecherche placeholder="Nom, téléphone, plaque, NIV, marque, modèle..." onRecherche={charger} />
      </div>

      {chargement ? (
        <Chargement />
      ) : clients.length === 0 ? (
        <EtatVide icone={Users} titre="Aucun client" message="Ajoutez votre premier client pour commencer." />
      ) : (
        <Tableau colonnes={colonnes} lignes={clients} surLigneClick={(c) => router.push(`/clients/${c.id}`)} />
      )}

      {showAdd && (
        <Modale titre="Nouveau client" surFermeture={() => setShowAdd(false)}>
          <FormulaireClient
            onSucces={() => {
              setShowAdd(false);
              charger("");
            }}
            onAnnuler={() => setShowAdd(false)}
          />
        </Modale>
      )}
    </div>
  );
}

function versUnClient(c: any, vehiculeCorrespondant: string | null = null): ClientRow {
  return {
    id: c.id,
    nom: c.nom,
    telephone: c.telephone,
    vehicule_count: c.vehicules?.[0]?.count ?? 0,
    vehicule_correspondant: vehiculeCorrespondant,
  };
}

function vers(data: any[] | null): ClientRow[] {
  return (data ?? []).map((c) => versUnClient(c));
}
