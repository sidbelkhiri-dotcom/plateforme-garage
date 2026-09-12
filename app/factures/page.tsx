"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Receipt, DollarSign, Ban, FileText } from "lucide-react";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import Modale from "@/components/ui/Modale";
import Bouton from "@/components/ui/Bouton";
import Champ from "@/components/ui/Champ";
import MessageErreur from "@/components/ui/MessageErreur";
import { useProfil } from "@/lib/useProfil";

type Statut = "impayee" | "partielle" | "payee" | "annulee";

type Facture = {
  id: string;
  numero: string;
  client_id: string | null;
  vehicule_id: string | null;
  date: string;
  statut: Statut;
  total_ttc: number;
  montant_paye: number;
  sans_taxe: boolean;
  libelle: string | null;
};

const FILTRES: { value: Statut | "impayees" | "toutes"; label: string }[] = [
  { value: "impayees", label: "Impayées + partielles" },
  { value: "toutes", label: "Toutes" },
  { value: "impayee", label: "Impayées" },
  { value: "partielle", label: "Partielles" },
  { value: "payee", label: "Payées" },
  { value: "annulee", label: "Annulées" },
];

const TON_STATUT: Record<Statut, ToneBadge> = {
  impayee: "rouge",
  partielle: "ambre",
  payee: "emeraude",
  annulee: "stone",
};

const LABEL_STATUT: Record<Statut, string> = {
  impayee: "Impayée",
  partielle: "Partielle",
  payee: "Payée",
  annulee: "Annulée",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function FacturesPage() {
  const supabase = createClient();
  const { peutAutoriser, estAdmin } = useProfil();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [vehicules, setVehicules] = useState<Record<string, string>>({});
  const [filtre, setFiltre] = useState<Statut | "impayees" | "toutes">("impayees");
  const [chargement, setChargement] = useState(true);
  const [facturePaiement, setFacturePaiement] = useState<Facture | null>(null);
  const [factureAAnnuler, setFactureAAnnuler] = useState<Facture | null>(null);


  const charger = useCallback(async () => {
    setChargement(true);
    const [{ data: f }, { data: c }, { data: v }] = await Promise.all([
      supabase.from("factures").select("id, numero, client_id, vehicule_id, date, statut, total_ttc, montant_paye, sans_taxe, libelle").order("date", { ascending: false }),
      supabase.from("clients").select("id, nom"),
      supabase.from("vehicules").select("id, marque, modele"),
    ]);
    setFactures(f ?? []);
    setClients(Object.fromEntries((c ?? []).map((x) => [x.id, x.nom])));
    setVehicules(Object.fromEntries((v ?? []).map((x) => [x.id, `${x.marque} ${x.modele ?? ""}`.trim()])));
    setChargement(false);
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  const [avecLibelleSeulement, setAvecLibelleSeulement] = useState(false);

  const filtrees = useMemo(() => {
    return factures.filter((f) => {
      if (avecLibelleSeulement && !f.libelle) return false;
      if (filtre === "impayees") return f.statut === "impayee" || f.statut === "partielle";
      if (filtre === "toutes") return true;
      return f.statut === filtre;
    });
  }, [factures, filtre, avecLibelleSeulement]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-[1.625rem] font-display font-bold uppercase tracking-[0.01em] text-mf-text">Factures</h1>
        <p className="text-sm text-mf-text-2">{filtrees.length} facture(s)</p>
      </div>

      {estAdmin && (
        <div className="flex flex-wrap items-center gap-3 mb-4 bg-mf-surface border border-mf-border rounded-mf-md p-4">
          <a
            href="/factures/rapport"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold border border-mf-border-strong text-mf-text hover:bg-mf-surface-2 transition-colors"
          >
            <FileText className="w-4 h-4" /> Rapport de facturation
          </a>
          <p className="text-xs text-mf-text-3">
            Pour ton comptable : choisis l&apos;année ou le trimestre, puis imprime ou exporte en CSV.
            La TPS et la TVQ se déclarent le plus souvent par trimestre.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 mb-4">
        {FILTRES.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltre(f.value)}
            className={`px-3 min-h-[40px] rounded-mf-pill text-xs font-semibold border transition-colors ${
              filtre === f.value
                ? "bg-mf-blue text-white border-mf-blue"
                : "bg-mf-surface text-mf-text-2 border-mf-border hover:bg-mf-surface-2"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setAvecLibelleSeulement((v) => !v)}
          aria-pressed={avecLibelleSeulement}
          className={`ml-2 px-3 min-h-[40px] rounded-mf-pill text-xs font-semibold border transition-colors ${
            avecLibelleSeulement
              ? "bg-mf-warning text-white border-mf-warning"
              : "bg-mf-surface text-mf-text-2 border-mf-border hover:bg-mf-surface-2"
          }`}
        >
          Avec libellé seulement
        </button>
      </div>

      {chargement ? (
        <Chargement />
      ) : filtrees.length === 0 ? (
        <EtatVide icone={Receipt} titre="Aucune facture" message="Rien à afficher pour ce filtre." />
      ) : (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
          {filtrees.map((f) => (
            <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <Link href={`/factures/${f.id}`} className="flex items-center gap-4 min-w-0 flex-1 text-mf-text hover:text-mf-blue-hover min-h-[44px]">
                <span className="font-mono text-sm font-semibold w-20 shrink-0">{f.numero}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {f.client_id ? clients[f.client_id] : "—"}
                    {f.vehicule_id && ` · ${vehicules[f.vehicule_id]}`}
                  </div>
                  <div className="text-xs text-mf-text-3">Livré le {f.date}</div>
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-sm text-mf-text">{formatMoney(f.total_ttc)}</span>
                {f.libelle && <Badge tone="ardoise">{f.libelle}</Badge>}
                <Badge tone={TON_STATUT[f.statut]}>{LABEL_STATUT[f.statut]}</Badge>
                {peutAutoriser && f.statut !== "payee" && f.statut !== "annulee" && (
                  <button
                    onClick={() => setFacturePaiement(f)}
                    className="flex items-center gap-1 text-xs font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px] px-2"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Paiement
                  </button>
                )}
                {estAdmin && f.statut !== "annulee" && (
                  <button
                    onClick={() => setFactureAAnnuler(f)}
                    className="flex items-center gap-1 text-xs font-semibold text-mf-text-3 hover:text-mf-red min-h-[44px] px-2"
                  >
                    <Ban className="w-3.5 h-3.5" /> Annuler la facture
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {facturePaiement && (
        <ModalePaiement
          facture={facturePaiement}
          surFermeture={() => setFacturePaiement(null)}
          surSucces={() => {
            setFacturePaiement(null);
            charger();
          }}
        />
      )}

      {factureAAnnuler && (
        <ModaleAnnulation
          facture={factureAAnnuler}
          surFermeture={() => setFactureAAnnuler(null)}
          surSucces={() => {
            setFactureAAnnuler(null);
            charger();
          }}
        />
      )}
    </div>
  );
}

function ModaleAnnulation({
  facture,
  surFermeture,
  surSucces,
}: {
  facture: Facture;
  surFermeture: () => void;
  surSucces: () => void;
}) {
  const supabase = createClient();
  const [motif, setMotif] = useState("");
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function confirmer() {
    if (!motif.trim()) {
      setErreur("Le motif est obligatoire.");
      return;
    }
    setEnEnvoi(true);
    setErreur(null);
    const { error } = await supabase.rpc("annuler_facture", {
      facture_id: facture.id,
      motif: motif.trim(),
    });
    setEnEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    surSucces();
  }

  return (
    <Modale titre={`Annuler ${facture.numero} ?`} surFermeture={surFermeture}>
      <p className="text-sm text-mf-text-2 mb-4">
        La facture sera marquée <b className="text-mf-text">annulée</b> — ses montants restent visibles pour l'historique, mais elle ne
        compte plus dans vos factures dues. Le bon de travail redevient facturable, pour émettre une facture
        corrigée si besoin. Cette action ne peut pas être annulée.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">Motif (obligatoire)</span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={2}
          placeholder="Ex. « erreur de montant, facture refaite »"
          className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft"
        />
      </label>
      {erreur && <MessageErreur className="mt-3">{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-5">
        <Bouton variante="secondaire" onClick={surFermeture}>
          Annuler
        </Bouton>
        <Bouton variante="danger" onClick={confirmer} enEnvoi={enEnvoi}>
          Confirmer l'annulation
        </Bouton>
      </div>
    </Modale>
  );
}

function ModalePaiement({
  facture,
  surFermeture,
  surSucces,
}: {
  facture: Facture;
  surFermeture: () => void;
  surSucces: () => void;
}) {
  const supabase = createClient();
  const solde = facture.total_ttc - facture.montant_paye;
  const [montant, setMontant] = useState(String(solde.toFixed(2)));
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer(montantRecu: number) {
    setEnEnvoi(true);
    setErreur(null);
    // enregistrer_paiement() additionne côté base, à partir de la valeur
    // réelle au moment de l'écriture — jamais depuis cet instantané local,
    // qui peut être périmé si un autre poste a encaissé entre-temps.
    const { error } = await supabase.rpc("enregistrer_paiement", {
      p_facture_id: facture.id,
      p_montant: montantRecu,
    });
    setEnEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    surSucces();
  }

  return (
    <Modale titre={`Paiement — ${facture.numero}`} surFermeture={surFermeture}>
      <div className="flex flex-col gap-1 text-sm mb-4 text-mf-text">
        <div className="flex justify-between">
          <span className="text-mf-text-2">Total de la facture</span>
          <span className="font-mono">{formatMoney(facture.total_ttc)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-mf-text-2">Déjà payé</span>
          <span className="font-mono">{formatMoney(facture.montant_paye)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t border-mf-border pt-1 mt-1">
          <span>Solde</span>
          <span className="font-mono">{formatMoney(solde)}</span>
        </div>
      </div>

      <Champ
        label="Montant reçu"
        type="number"
        step="0.01"
        min="0"
        value={montant}
        onChange={(e) => setMontant(e.target.value)}
      />

      {erreur && <MessageErreur className="mt-3">{erreur}</MessageErreur>}

      <div className="flex justify-end gap-2 mt-5">
        <Bouton variante="secondaire" onClick={surFermeture}>
          Annuler
        </Bouton>
        <Bouton variante="secondaire" onClick={() => enregistrer(solde)} enEnvoi={enEnvoi}>
          Marquer payée en entier
        </Bouton>
        <Bouton onClick={() => enregistrer(Number(montant) || 0)} enEnvoi={enEnvoi}>
          Enregistrer
        </Bouton>
      </div>
    </Modale>
  );
}
