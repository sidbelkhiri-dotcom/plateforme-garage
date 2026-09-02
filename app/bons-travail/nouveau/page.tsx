"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Search, Plus, Check, Car, User, History } from "lucide-react";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import Badge from "@/components/ui/Badge";
import MessageErreur from "@/components/ui/MessageErreur";
import Chargement from "@/components/ui/Chargement";
import { todayLocal, formatDateLong } from "@/lib/dates";

type Client = { id: string; nom: string; telephone: string | null };
type Vehicule = { id: string; marque: string; modele: string | null; annee: number | null };
type BonHistorique = {
  id: string;
  numero: string;
  statut: string;
  vehicule_id: string | null;
  ouvert_le: string;
  plainte_client: string;
};

const LABEL_STATUT: Record<string, string> = {
  evaluation: "Évaluation",
  autorise: "Autorisé",
  en_cours: "En cours",
  attente_piece: "Attente pièce",
  termine: "Terminé",
  facture: "Facturé",
  annule: "Annulé",
};

export default function NouveauBonTravailPage() {
  return (
    <Suspense fallback={<div className="p-6"><Chargement /></div>}>
      <NouveauBonTravailContenu />
    </Suspense>
  );
}

function NouveauBonTravailContenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const rdvId = searchParams.get("rdv");
  const clientPreselectionne = searchParams.get("client");
  const vehiculePreselectionne = searchParams.get("vehicule");
  const employePreselectionne = searchParams.get("employe");

  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [clientSelectionne, setClientSelectionne] = useState<Client | null>(null);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [vehiculeId, setVehiculeId] = useState("");
  const [historique, setHistorique] = useState<BonHistorique[]>([]);
  const [mecaniciens, setMecaniciens] = useState<{ id: string; nom: string }[]>([]);
  const [employeId, setEmployeId] = useState(employePreselectionne ?? "");
  const [kilometrage, setKilometrage] = useState("");
  const [plainteClient, setPlainteClient] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, nom, telephone")
      .order("nom")
      .then(({ data }) => {
        setClients(data ?? []);
        if (clientPreselectionne) {
          const c = (data ?? []).find((x) => x.id === clientPreselectionne);
          if (c) setClientSelectionne(c);
        }
      });
    supabase
      .from("profiles")
      .select("id, nom")
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => setMecaniciens(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientSelectionne) {
      setVehicules([]);
      setHistorique([]);
      return;
    }
    supabase
      .from("vehicules")
      .select("id, marque, modele, annee")
      .eq("client_id", clientSelectionne.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setVehicules(data ?? []);
        setVehiculeId(vehiculePreselectionne && data?.some((v) => v.id === vehiculePreselectionne) ? vehiculePreselectionne : data?.[0]?.id ?? "");
      });
    // Contexte pour ne pas repartir de zéro avec un client déjà connu —
    // même requête que l'historique de la fiche client, limitée à 5 ici
    // (compact, un lien renvoie vers l'historique complet).
    supabase
      .from("bons_travail")
      .select("id, numero, statut, vehicule_id, ouvert_le, plainte_client")
      .eq("client_id", clientSelectionne.id)
      .order("ouvert_le", { ascending: false })
      .limit(5)
      .then(({ data }) => setHistorique(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientSelectionne]);

  const filtres = clients.filter((c) => c.nom.toLowerCase().includes(q.toLowerCase()));

  async function creer() {
    if (!clientSelectionne || !kilometrage || !plainteClient.trim()) return;
    setCreation(true);
    setErreur(null);

    const { data: parametres } = await supabase.from("parametres").select("taux_horaire").single();

    const { data, error } = await supabase
      .from("bons_travail")
      .insert({
        client_id: clientSelectionne.id,
        vehicule_id: vehiculeId || null,
        rendez_vous_id: rdvId || null,
        employe_id: employeId || null,
        kilometrage: Number(kilometrage),
        plainte_client: plainteClient.trim(),
        taux_horaire: parametres?.taux_horaire ?? 0,
        statut: "evaluation",
        // Jamais le défaut `current_date` du schéma : ce serait de l'UTC
        // côté base de données, le même piège que D18 déplacé d'un cran (D18).
        ouvert_le: todayLocal(),
      })
      .select()
      .single();

    setCreation(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    if (data) router.push(`/bons-travail/${data.id}`);
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => router.push("/bons-travail")}
        className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux bons de travail
      </button>

      <h1 className="text-xl font-display font-black uppercase tracking-wide mb-1 text-mf-text">Nouveau bon de travail</h1>
      <p className="text-sm text-mf-text-2 mb-6">
        Le kilométrage et la plainte du client sont obligatoires — ils servent à la facture et au rappel
        d'entretien plus tard.
      </p>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
          <User className="w-4 h-4" /> 1. Client
        </h2>
        {clientSelectionne ? (
          <div className="flex items-center justify-between bg-mf-success-soft border border-mf-success rounded-mf-sm px-3 py-2 min-h-[44px]">
            <span className="text-sm font-semibold flex items-center gap-2 text-mf-text">
              <Check className="w-4 h-4 text-mf-success" /> {clientSelectionne.nom}
            </span>
            <button onClick={() => setClientSelectionne(null)} className="text-xs text-mf-text-2 hover:text-mf-text">
              Changer
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mf-text-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un client..."
                className="bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm pl-9 pr-3 min-h-[44px] text-sm text-mf-text w-full focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft"
              />
            </div>
            <div className="max-h-48 overflow-y-auto border border-mf-border rounded-mf-sm divide-y divide-mf-border">
              {filtres.length === 0 ? (
                <p className="text-sm text-mf-text-2 px-3 py-3">
                  Aucun résultat.{" "}
                  <a href="/clients" className="text-mf-blue-hover underline">
                    Créer un client
                  </a>
                  .
                </p>
              ) : (
                filtres.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setClientSelectionne(c)}
                    className="w-full text-left px-3 py-2.5 text-sm text-mf-text hover:bg-mf-surface-2 min-h-[44px]"
                  >
                    {c.nom} {c.telephone && <span className="text-mf-text-3">· {c.telephone}</span>}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {clientSelectionne && historique.length > 0 && (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <History className="w-4 h-4" /> Historique récent
          </h2>
          <div className="divide-y divide-mf-border border border-mf-border rounded-mf-sm overflow-hidden">
            {historique.map((b) => {
              const v = vehicules.find((x) => x.id === b.vehicule_id);
              return (
                <a
                  key={b.id}
                  href={`/bons-travail/${b.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-3 py-2.5 hover:bg-mf-surface-2 min-h-[44px]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="font-mono text-sm font-semibold text-mf-text">{b.numero}</span>
                      {v && <span className="text-xs text-mf-text-3 ml-2">{v.marque} {v.modele}</span>}
                      <span className="text-xs text-mf-text-3 ml-2">{formatDateLong(b.ouvert_le)}</span>
                    </span>
                    <Badge tone={b.statut === "termine" || b.statut === "facture" ? "emeraude" : b.statut === "annule" ? "rouge" : "ardoise"}>
                      {LABEL_STATUT[b.statut] ?? b.statut}
                    </Badge>
                  </div>
                  <p className="text-xs text-mf-text-2 mt-0.5 truncate">{b.plainte_client}</p>
                </a>
              );
            })}
          </div>
          <a
            href={`/clients/${clientSelectionne.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-mf-blue-hover hover:text-mf-blue underline mt-2 inline-block"
          >
            Voir tout l'historique du client
          </a>
        </div>
      )}

      {clientSelectionne && (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <Car className="w-4 h-4" /> 2. Véhicule
          </h2>
          {vehicules.length === 0 ? (
            <p className="text-sm text-mf-text-2">
              Ce client n'a aucun véhicule enregistré.{" "}
              <a href={`/clients/${clientSelectionne.id}`} className="text-mf-blue-hover underline">
                En ajouter un
              </a>
              .
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {vehicules.map((v) => (
                <label
                  key={v.id}
                  className={`flex items-center gap-2 border rounded-mf-sm px-3 py-2.5 text-sm cursor-pointer min-h-[44px] text-mf-text ${
                    vehiculeId === v.id ? "border-mf-blue bg-mf-blue-soft" : "border-mf-border"
                  }`}
                >
                  <input type="radio" checked={vehiculeId === v.id} onChange={() => setVehiculeId(v.id)} />
                  {v.marque} {v.modele} {v.annee ? `(${v.annee})` : ""}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {clientSelectionne && (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4 flex flex-col gap-3">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide mb-1 text-mf-text">3. À l'arrivée du véhicule</h2>
          <Champ
            label="Kilométrage"
            type="number"
            required
            value={kilometrage}
            onChange={(e) => setKilometrage(e.target.value)}
          />
          <Champ
            label="Plainte du client"
            required
            placeholder="Dans ses mots à lui — ex. « ça fait un bruit au freinage »"
            value={plainteClient}
            onChange={(e) => setPlainteClient(e.target.value)}
          />
          <Selecteur label="Mécanicien assigné" value={employeId} onChange={(e) => setEmployeId(e.target.value)}>
            <option value="">— Non assigné —</option>
            {mecaniciens.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nom}
              </option>
            ))}
          </Selecteur>
        </div>
      )}

      {erreur && <MessageErreur className="mb-4">{erreur}</MessageErreur>}

      <Bouton
        className="w-full justify-center"
        disabled={!clientSelectionne || !kilometrage || !plainteClient.trim()}
        enEnvoi={creation}
        onClick={creer}
      >
        Créer le bon de travail
      </Bouton>
    </div>
  );
}
