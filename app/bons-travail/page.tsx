"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Wrench, AlertTriangle } from "lucide-react";
import Selecteur from "@/components/ui/Selecteur";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import { useProfil } from "@/lib/useProfil";

type Statut = "evaluation" | "autorise" | "en_cours" | "attente_piece" | "termine" | "facture" | "annule";

type BonTotaux = {
  id: string;
  numero: string;
  statut: Statut;
  montant_evaluation: number | null;
  total_ht: number;
  depasse_evaluation: boolean;
};

type Bon = {
  id: string;
  numero: string;
  client_id: string | null;
  vehicule_id: string | null;
  employe_id: string | null;
  statut: Statut;
  ouvert_le: string;
};

const STATUTS: { value: Statut | "ouverts" | "tous"; label: string }[] = [
  { value: "ouverts", label: "Ouverts" },
  { value: "tous", label: "Tous" },
  { value: "evaluation", label: "Évaluation" },
  { value: "autorise", label: "Autorisé" },
  { value: "en_cours", label: "En cours" },
  { value: "attente_piece", label: "Attente pièce" },
  { value: "termine", label: "Terminé" },
  { value: "annule", label: "Annulé" },
];

const TON_STATUT: Record<Statut, ToneBadge> = {
  evaluation: "ardoise",
  autorise: "ambre",
  en_cours: "ambre",
  attente_piece: "rouge",
  termine: "emeraude",
  facture: "emeraude",
  annule: "rouge",
};

const LABEL_STATUT: Record<Statut, string> = {
  evaluation: "Évaluation",
  autorise: "Autorisé",
  en_cours: "En cours",
  attente_piece: "Attente pièce",
  termine: "Terminé",
  facture: "Facturé",
  annule: "Annulé",
};

export default function BonsTravailPage() {
  const supabase = createClient();
  const { peutAutoriser } = useProfil();
  const [bons, setBons] = useState<Bon[]>([]);
  const [totaux, setTotaux] = useState<Record<string, BonTotaux>>({});
  const [clients, setClients] = useState<Record<string, string>>({});
  const [vehicules, setVehicules] = useState<Record<string, string>>({});
  const [mecaniciens, setMecaniciens] = useState<{ id: string; nom: string }[]>([]);
  const [filtreStatut, setFiltreStatut] = useState<Statut | "ouverts" | "tous">("ouverts");
  const [filtreEmploye, setFiltreEmploye] = useState("");
  const [chargement, setChargement] = useState(true);

  const charger = useCallback(async () => {
    setChargement(true);
    const [{ data: b }, { data: t }, { data: c }, { data: v }, { data: m }] = await Promise.all([
      supabase.from("bons_travail").select("id, numero, client_id, vehicule_id, employe_id, statut, ouvert_le").order("ouvert_le", { ascending: false }),
      supabase.from("bons_travail_totaux").select("*"),
      supabase.from("clients").select("id, nom"),
      supabase.from("vehicules").select("id, marque, modele"),
      supabase.from("profiles").select("id, nom").eq("actif", true).order("nom"),
    ]);
    setBons(b ?? []);
    setTotaux(Object.fromEntries((t ?? []).map((x) => [x.id, x])));
    setClients(Object.fromEntries((c ?? []).map((x) => [x.id, x.nom])));
    setVehicules(Object.fromEntries((v ?? []).map((x) => [x.id, `${x.marque} ${x.modele ?? ""}`.trim()])));
    setMecaniciens(m ?? []);
    setChargement(false);
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const filtres = useMemo(() => {
    return bons.filter((b) => {
      if (filtreStatut === "ouverts" && ["termine", "facture", "annule"].includes(b.statut)) return false;
      if (filtreStatut !== "ouverts" && filtreStatut !== "tous" && b.statut !== filtreStatut) return false;
      if (filtreEmploye && b.employe_id !== filtreEmploye) return false;
      return true;
    });
  }, [bons, filtreStatut, filtreEmploye]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">Bons de travail</h1>
          <p className="text-sm text-mf-text-2">{filtres.length} bon(s)</p>
        </div>
        {peutAutoriser && (
          <Link
            href="/bons-travail/nouveau"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold bg-mf-blue hover:bg-mf-blue-hover text-white transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouveau bon
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="flex flex-wrap gap-1">
          {STATUTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setFiltreStatut(s.value)}
              className={`px-3 min-h-[40px] rounded-mf-pill text-xs font-semibold border transition-colors ${
                filtreStatut === s.value
                  ? "bg-mf-blue text-white border-mf-blue"
                  : "bg-mf-surface text-mf-text-2 border-mf-border hover:bg-mf-surface-2"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="w-56">
          <Selecteur label="" value={filtreEmploye} onChange={(e) => setFiltreEmploye(e.target.value)}>
            <option value="">Tous les mécaniciens</option>
            {mecaniciens.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </Selecteur>
        </div>
      </div>

      {chargement ? (
        <Chargement />
      ) : filtres.length === 0 ? (
        <EtatVide icone={Wrench} titre="Aucun bon de travail" message="Rien à afficher pour ce filtre." />
      ) : (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
          {filtres.map((b) => {
            const t = totaux[b.id];
            const nomMecanicien = mecaniciens.find((m) => m.id === b.employe_id)?.nom;
            return (
              <Link
                key={b.id}
                href={`/bons-travail/${b.id}`}
                className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-mf-surface-2 min-h-[44px]"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-mono text-sm font-semibold w-20 shrink-0 text-mf-text">{b.numero}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate text-mf-text">
                      {b.client_id ? clients[b.client_id] : "—"}
                      {b.vehicule_id && ` · ${vehicules[b.vehicule_id]}`}
                    </div>
                    <div className="text-xs text-mf-text-3 truncate">
                      {nomMecanicien ?? "Non assigné"} · ouvert le {b.ouvert_le}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t?.depasse_evaluation && (
                    <span title="Dépasse l'évaluation acceptée">
                      <AlertTriangle className="w-4 h-4 text-mf-red" />
                    </span>
                  )}
                  <Badge tone={TON_STATUT[b.statut]}>{LABEL_STATUT[b.statut]}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
