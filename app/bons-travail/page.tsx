"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Plus, Wrench, AlertTriangle } from "lucide-react";
import Selecteur from "@/components/ui/Selecteur";
import Badge from "@/components/ui/Badge";
import Pastilles from "@/components/ui/Pastilles";
import { STATUT_BON, type StatutBon } from "@/lib/statuts";
import { formatDateCourte } from "@/lib/dates";
import { pluriel } from "@/lib/texte";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import { useProfil } from "@/lib/useProfil";

type Statut = StatutBon;

// Format monétaire canadien-français, comme sur le tableau de bord.
const argent = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);

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
          <h1 className="text-[1.625rem] font-display font-bold uppercase tracking-[0.01em] text-mf-text">Bons de travail</h1>
          <p className="text-sm text-mf-text-2">{pluriel(filtres.length, "bon")}</p>
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
        <div className="w-full lg:w-auto lg:flex-1 min-w-0">
          <Pastilles libelle="Filtrer par statut" options={STATUTS} valeur={filtreStatut} onChange={setFiltreStatut} />
        </div>
        <div className="w-full sm:w-56">
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
                className="px-4 py-3 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 sm:flex sm:gap-4 hover:bg-mf-surface-2 min-h-[44px]"
              >
                {/* Deux étages sur téléphone (numéro et état, puis client et
                    montant), une seule ligne dès la tablette : sur 375 px, la
                    ligne unique réduisait le client à « Marc-Andr… ». */}
                <span className="font-mono text-sm font-semibold sm:w-20 shrink-0 text-mf-text">{b.numero}</span>
                <span className="flex items-center justify-end gap-2 shrink-0 sm:order-4 sm:w-[128px]">
                  {t?.depasse_evaluation && (
                    <span title="Dépasse l'évaluation acceptée">
                      <AlertTriangle className="w-4 h-4 text-mf-red" aria-label="Dépasse l'évaluation acceptée" />
                    </span>
                  )}
                  <Badge tone={STATUT_BON[b.statut].ton}>{STATUT_BON[b.statut].label}</Badge>
                </span>
                <div className="min-w-0 sm:flex-1 sm:order-2">
                  <div className="text-sm font-medium truncate text-mf-text">
                    {b.client_id ? clients[b.client_id] : "—"}
                    {b.vehicule_id && ` · ${vehicules[b.vehicule_id]}`}
                  </div>
                  <div className="text-xs text-mf-text-3 truncate">
                    {nomMecanicien ?? "Non assigné"} · {formatDateCourte(b.ouvert_le)}
                  </div>
                </div>
                {/* Le montant courant : le premier chiffre qu'un patron
                    d'atelier cherche en balayant la liste. Chasse tabulaire et
                    largeur fixe pour que la colonne s'aligne d'une ligne à
                    l'autre. */}
                <span className="text-sm font-mono tabular-nums text-right text-mf-text-2 self-start sm:self-auto sm:order-3 sm:w-28">
                  {t ? argent(t.total_ht) : ""}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
