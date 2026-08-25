"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Clock } from "lucide-react";
import Modale from "@/components/ui/Modale";
import Bouton from "@/components/ui/Bouton";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Selecteur from "@/components/ui/Selecteur";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import FormulaireRendezVous, { STATUTS_RDV, type RdvStatut } from "@/components/forms/FormulaireRendezVous";
import BoutonEnvoyerConfirmationRdv from "@/components/BoutonEnvoyerConfirmationRdv";
import { todayLocal, addDaysLocal, startOfWeekLocal, formatDateLong, formatTimeShort } from "@/lib/dates";

type Rdv = {
  id: string;
  client_id: string | null;
  vehicule_id: string | null;
  employe_id: string | null;
  date: string;
  heure: string;
  duree_min: number;
  description: string;
  statut: RdvStatut;
};

const JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const TON_STATUT: Record<RdvStatut, ToneBadge> = {
  prevu: "ardoise",
  confirme: "emeraude",
  en_cours: "ambre",
  termine: "emeraude",
  annule: "rouge",
  absent: "rouge",
};

export default function RendezVousPage() {
  const supabase = createClient();
  const [vue, setVue] = useState<"jour" | "semaine">("semaine");
  const [dateRef, setDateRef] = useState(todayLocal());
  const [rdvs, setRdvs] = useState<Rdv[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [mecaniciens, setMecaniciens] = useState<{ id: string; nom: string }[]>([]);
  const [filtreEmploye, setFiltreEmploye] = useState("");
  const [chargement, setChargement] = useState(true);
  const [showAjout, setShowAjout] = useState<{ date: string } | null>(null);
  const [rdvEnEdition, setRdvEnEdition] = useState<Rdv | null>(null);

  const debut = vue === "jour" ? dateRef : startOfWeekLocal(dateRef);
  const fin = vue === "jour" ? dateRef : addDaysLocal(debut, 6);
  const jours = useMemo(() => {
    if (vue === "jour") return [dateRef];
    return Array.from({ length: 7 }, (_, i) => addDaysLocal(debut, i));
  }, [vue, dateRef, debut]);

  const charger = useCallback(async () => {
    setChargement(true);
    const [{ data: r }, { data: c }, { data: m }] = await Promise.all([
      supabase
        .from("rendez_vous")
        .select("*")
        .gte("date", debut)
        .lte("date", fin)
        .order("heure"),
      supabase.from("clients").select("id, nom"),
      supabase.from("profiles").select("id, nom").eq("actif", true).order("nom"),
    ]);
    setRdvs(r ?? []);
    setClients(Object.fromEntries((c ?? []).map((x) => [x.id, x.nom])));
    setMecaniciens(m ?? []);
    setChargement(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debut, fin]);

  useEffect(() => {
    charger();
  }, [charger]);

  const rdvsFiltres = filtreEmploye ? rdvs.filter((r) => r.employe_id === filtreEmploye) : rdvs;
  const today = todayLocal();

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">Rendez-vous</h1>
          <p className="text-sm text-mf-text-2">
            {vue === "jour" ? formatDateLong(dateRef) : `Semaine du ${formatDateLong(debut)}`}
          </p>
        </div>
        <Bouton onClick={() => setShowAjout({ date: dateRef })}>
          <Plus className="w-4 h-4" /> Nouveau RDV
        </Bouton>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex rounded-mf-sm border border-mf-border overflow-hidden">
            <button
              onClick={() => setVue("jour")}
              className={`px-3 min-h-[44px] text-sm font-semibold ${vue === "jour" ? "bg-mf-blue text-white" : "bg-mf-surface text-mf-text-2"}`}
            >
              Jour
            </button>
            <button
              onClick={() => setVue("semaine")}
              className={`px-3 min-h-[44px] text-sm font-semibold ${vue === "semaine" ? "bg-mf-blue text-white" : "bg-mf-surface text-mf-text-2"}`}
            >
              Semaine
            </button>
          </div>
          <button
            onClick={() => setDateRef(today)}
            className="border border-mf-border hover:bg-mf-surface-2 px-3 min-h-[44px] rounded-mf-sm text-sm font-semibold text-mf-text-2"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setDateRef((d) => addDaysLocal(d, vue === "jour" ? -1 : -7))}
            className="border border-mf-border hover:bg-mf-surface-2 w-11 h-11 flex items-center justify-center rounded-mf-sm text-mf-text-2"
            aria-label="Précédent"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDateRef((d) => addDaysLocal(d, vue === "jour" ? 1 : 7))}
            className="border border-mf-border hover:bg-mf-surface-2 w-11 h-11 flex items-center justify-center rounded-mf-sm text-mf-text-2"
            aria-label="Suivant"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
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
      ) : vue === "jour" ? (
        <VueJour
          rdvs={rdvsFiltres}
          clients={clients}
          mecaniciens={mecaniciens}
          onClickRdv={setRdvEnEdition}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {jours.map((jourIso, i) => (
            <ColonneJour
              key={jourIso}
              label={JOURS[i]}
              iso={jourIso}
              estAujourdhui={jourIso === today}
              rdvs={rdvsFiltres.filter((r) => r.date === jourIso)}
              clients={clients}
              onAjouter={() => setShowAjout({ date: jourIso })}
              onClickRdv={setRdvEnEdition}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-mf-text-3">
        {STATUTS_RDV.map((s) => (
          <span key={s.value} className="flex items-center gap-1.5">
            <Badge tone={TON_STATUT[s.value]}>{s.label}</Badge>
          </span>
        ))}
      </div>

      {showAjout && (
        <Modale titre="Nouveau rendez-vous" surFermeture={() => setShowAjout(null)}>
          <FormulaireRendezVous
            valeursInitiales={{ date: showAjout.date }}
            onSucces={() => {
              setShowAjout(null);
              charger();
            }}
            onAnnuler={() => setShowAjout(null)}
          />
        </Modale>
      )}

      {rdvEnEdition && (
        <Modale titre="Modifier le rendez-vous" surFermeture={() => setRdvEnEdition(null)}>
          <FormulaireRendezVous
            rdvId={rdvEnEdition.id}
            valeursInitiales={{
              client_id: rdvEnEdition.client_id ?? "",
              vehicule_id: rdvEnEdition.vehicule_id ?? "",
              employe_id: rdvEnEdition.employe_id ?? "",
              date: rdvEnEdition.date,
              heure: rdvEnEdition.heure?.slice(0, 5),
              duree_min: String(rdvEnEdition.duree_min),
              description: rdvEnEdition.description,
              statut: rdvEnEdition.statut,
            }}
            onSucces={() => {
              setRdvEnEdition(null);
              charger();
            }}
            onAnnuler={() => setRdvEnEdition(null)}
          />
          {rdvEnEdition.client_id && (
            <div className="border-t border-mf-border mt-4 pt-4 flex flex-col gap-3">
              <BoutonEnvoyerConfirmationRdv rdvId={rdvEnEdition.id} />
              <Link
                href={`/bons-travail/nouveau?rdv=${rdvEnEdition.id}&client=${rdvEnEdition.client_id}${
                  rdvEnEdition.vehicule_id ? `&vehicule=${rdvEnEdition.vehicule_id}` : ""
                }${rdvEnEdition.employe_id ? `&employe=${rdvEnEdition.employe_id}` : ""}`}
                className="text-sm font-semibold text-mf-blue-hover hover:text-mf-blue"
              >
                Créer le bon de travail à partir de ce rendez-vous →
              </Link>
            </div>
          )}
        </Modale>
      )}
    </div>
  );
}

function VueJour({
  rdvs,
  clients,
  mecaniciens,
  onClickRdv,
}: {
  rdvs: Rdv[];
  clients: Record<string, string>;
  mecaniciens: { id: string; nom: string }[];
  onClickRdv: (r: Rdv) => void;
}) {
  const nomMecanicien = (id: string | null) => mecaniciens.find((m) => m.id === id)?.nom;

  if (rdvs.length === 0) {
    return <EtatVide icone={CalendarDays} titre="Aucun rendez-vous" message="Rien de prévu ce jour-là." />;
  }

  return (
    <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
      {rdvs.map((r) => (
        <button
          key={r.id}
          onClick={() => onClickRdv(r)}
          className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-mf-surface-2 min-h-[44px]"
        >
          <span className="font-mono text-sm font-semibold w-16 shrink-0 flex items-center gap-1.5 text-mf-text">
            <Clock className="w-3.5 h-3.5 text-mf-text-3" /> {formatTimeShort(r.heure)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-mf-text">{r.description}</div>
            <div className="text-xs text-mf-text-3 truncate">
              {r.client_id && clients[r.client_id]}
              {r.employe_id && ` · ${nomMecanicien(r.employe_id)}`}
            </div>
          </div>
          <Badge tone={TON_STATUT[r.statut]}>{STATUTS_RDV.find((s) => s.value === r.statut)?.label}</Badge>
        </button>
      ))}
    </div>
  );
}

function ColonneJour({
  label,
  iso,
  estAujourdhui,
  rdvs,
  clients,
  onAjouter,
  onClickRdv,
}: {
  label: string;
  iso: string;
  estAujourdhui: boolean;
  rdvs: Rdv[];
  clients: Record<string, string>;
  onAjouter: () => void;
  onClickRdv: (r: Rdv) => void;
}) {
  const jourNum = Number(iso.split("-")[2]);
  return (
    <div
      className={`bg-mf-surface rounded-mf-md border ${estAujourdhui ? "border-mf-blue" : "border-mf-border"} min-h-[200px] flex flex-col`}
    >
      <div className={`px-3 py-2 border-b ${estAujourdhui ? "border-mf-blue bg-mf-blue-soft" : "border-mf-border"}`}>
        <div className="text-[10px] font-bold uppercase tracking-wide text-mf-text-3">{label}</div>
        <div className={`text-sm font-bold ${estAujourdhui ? "text-mf-blue-hover" : "text-mf-text"}`}>{jourNum}</div>
      </div>
      <div className="flex-1 p-2 flex flex-col gap-1.5">
        {rdvs.length === 0 ? (
          <p className="text-xs text-mf-text-3 text-center py-4">—</p>
        ) : (
          rdvs.map((r) => (
            <button
              key={r.id}
              onClick={() => onClickRdv(r)}
              className="text-left rounded-mf-sm px-2 py-1.5 text-xs border border-mf-border bg-mf-surface-2 hover:bg-mf-surface-3 min-h-[44px]"
            >
              <div className="flex items-center gap-1.5 font-mono font-semibold text-mf-text">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    TON_STATUT[r.statut] === "rouge"
                      ? "bg-mf-red"
                      : TON_STATUT[r.statut] === "emeraude"
                        ? "bg-mf-success"
                        : TON_STATUT[r.statut] === "ambre"
                          ? "bg-mf-warning"
                          : "bg-mf-text-3"
                  }`}
                />
                {formatTimeShort(r.heure)}
              </div>
              {r.client_id && <div className="font-medium truncate text-mf-text">{clients[r.client_id]}</div>}
              <div className="text-mf-text-3 truncate">{r.description}</div>
            </button>
          ))
        )}
        <button
          onClick={onAjouter}
          className="mt-auto flex items-center justify-center gap-1 text-[11px] text-mf-text-3 hover:text-mf-blue-hover py-2 min-h-[44px]"
        >
          <Plus className="w-3 h-3" /> Ajouter
        </button>
      </div>
    </div>
  );
}
