"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Car, Pencil, Trash2, History, ShieldCheck, ShieldAlert, Gauge, ArrowRightLeft, Search } from "lucide-react";
import Modale from "@/components/ui/Modale";
import ModaleConfirmation from "@/components/ui/ModaleConfirmation";
import Bouton from "@/components/ui/Bouton";
import Badge from "@/components/ui/Badge";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import MessageErreur from "@/components/ui/MessageErreur";
import FormulaireVehicule from "@/components/forms/FormulaireVehicule";
import { useProfil } from "@/lib/useProfil";
import { todayLocal, formatDateLong } from "@/lib/dates";
import { estSousGarantie } from "@/lib/garantie";

type Vehicule = {
  id: string;
  client_id: string;
  marque: string;
  modele: string | null;
  annee: number | null;
  plaque: string | null;
  vin: string | null;
  couleur: string | null;
};

type Client = { id: string; nom: string };

type Bon = {
  id: string;
  numero: string;
  statut: string;
  kilometrage: number;
  plainte_client: string;
  diagnostic: string | null;
  ouvert_le: string;
  ferme_le: string | null;
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

export default function VehiculeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { peutGererClients, estAdmin } = useProfil();

  const [vehicule, setVehicule] = useState<Vehicule | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [bons, setBons] = useState<Bon[]>([]);
  const [garantieParams, setGarantieParams] = useState({ garantie_mois: 3, garantie_km: 5000 });
  const [chargement, setChargement] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showSupprimer, setShowSupprimer] = useState(false);
  const [showTransfert, setShowTransfert] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data: v } = await supabase.from("vehicules").select("*").eq("id", id).single();
    setVehicule(v);
    if (v) {
      const [{ data: c }, { data: b }, { data: p }] = await Promise.all([
        supabase.from("clients").select("id, nom").eq("id", v.client_id).single(),
        supabase
          .from("bons_travail")
          .select("id, numero, statut, kilometrage, plainte_client, diagnostic, ouvert_le, ferme_le")
          .eq("vehicule_id", id)
          .order("ouvert_le", { ascending: false }),
        supabase.from("parametres").select("garantie_mois, garantie_km").eq("id", 1).single(),
      ]);
      setClient(c);
      setBons(b ?? []);
      if (p) setGarantieParams(p);
    }
    setChargement(false);
  }, [id, supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (chargement) return <div className="p-6"><Chargement /></div>;
  if (!vehicule) return <div className="p-6 text-sm text-mf-text-2">Véhicule introuvable.</div>;

  // Kilométrage le plus récent connu — sert de référence "aujourd'hui"
  // pour juger si une réparation passée est encore sous garantie (7.3).
  const kilometrageActuel = bons.reduce((max, b) => Math.max(max, b.kilometrage), 0);
  const aujourdHui = todayLocal();

  return (
    <div className="p-6">
      <button
        onClick={() => router.push(client ? `/clients/${client.id}` : "/clients")}
        className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Retour {client ? `à ${client.nom}` : "aux clients"}
      </button>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-mf-text-3" />
            <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">
              {vehicule.marque} {vehicule.modele}
            </h1>
          </div>
          {peutGererClients && (
            <div className="flex gap-2">
              <Bouton variante="secondaire" onClick={() => setShowEdit(true)}>
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </Bouton>
              <Bouton variante="secondaire" onClick={() => setShowTransfert(true)}>
                <ArrowRightLeft className="w-3.5 h-3.5" /> Transférer
              </Bouton>
              {estAdmin && (
                <Bouton variante="danger" onClick={() => setShowSupprimer(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </Bouton>
              )}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 text-sm">
          <Detail titre="Année" valeur={vehicule.annee ?? "—"} />
          <Detail titre="Plaque" valeur={vehicule.plaque ?? "—"} />
          <Detail titre="NIV (VIN)" valeur={vehicule.vin ?? "—"} />
          <Detail titre="Couleur" valeur={vehicule.couleur ?? "—"} />
          <Detail
            titre="Kilométrage actuel"
            valeur={
              bons.length > 0 ? (
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-mf-text-3" /> {kilometrageActuel.toLocaleString("fr-CA")} km
                </span>
              ) : (
                "—"
              )
            }
          />
          <Detail
            titre="Client"
            valeur={
              client ? (
                <Link href={`/clients/${client.id}`} className="text-mf-blue-hover hover:underline">
                  {client.nom}
                </Link>
              ) : (
                "—"
              )
            }
          />
        </dl>
      </div>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
          <History className="w-4 h-4" /> Historique ({bons.length})
        </h2>

        {bons.length === 0 ? (
          <EtatVide icone={History} titre="Aucun bon de travail" message="Rien n'a encore été fait sur ce véhicule." />
        ) : (
          <div className="divide-y divide-mf-border">
            {bons.map((b, i) => {
              const bonPrecedent = bons[i + 1]; // liste triée décroissant : le suivant dans la liste = plus ancien
              const progression = bonPrecedent ? b.kilometrage - bonPrecedent.kilometrage : null;
              const garantie = estSousGarantie({
                fermeLe: b.ferme_le,
                kilometrageBon: b.kilometrage,
                garantieMois: garantieParams.garantie_mois,
                garantieKm: garantieParams.garantie_km,
                kilometrageActuel,
                aujourdHui,
              });

              return (
                <Link
                  key={b.id}
                  href={`/bons-travail/${b.id}`}
                  className="py-3 flex flex-col gap-1 hover:bg-mf-surface-2 -mx-2 px-2 rounded-mf-sm min-h-[44px]"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-mono text-sm font-semibold text-mf-text">{b.numero}</span>
                    <div className="flex items-center gap-2">
                      {garantie && (
                        <span
                          className={`flex items-center gap-1 text-xs font-semibold ${
                            garantie.couverte ? "text-mf-success" : "text-mf-text-3"
                          }`}
                          title={`Garantie jusqu'au ${formatDateLong(garantie.dateLimite)} ou ${garantie.kmLimite.toLocaleString("fr-CA")} km`}
                        >
                          {garantie.couverte ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                          {garantie.couverte ? "Sous garantie" : "Garantie expirée"}
                        </span>
                      )}
                      <Badge tone={b.statut === "termine" ? "emeraude" : b.statut === "annule" ? "rouge" : "ardoise"}>
                        {LABEL_STATUT[b.statut] ?? b.statut}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-mf-text">{b.diagnostic || b.plainte_client}</div>
                  <div className="text-xs text-mf-text-3 flex flex-wrap gap-x-3">
                    <span>{formatDateLong(b.ouvert_le)}</span>
                    <span>{b.kilometrage.toLocaleString("fr-CA")} km</span>
                    {progression != null && (
                      <span className={progression >= 0 ? "text-mf-text-3" : "text-mf-red"}>
                        {progression >= 0 ? "+" : ""}
                        {progression.toLocaleString("fr-CA")} km depuis la visite précédente
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {showEdit && (
        <Modale titre="Modifier le véhicule" surFermeture={() => setShowEdit(false)}>
          <FormulaireVehicule
            clientId={vehicule.client_id}
            vehiculeId={vehicule.id}
            valeursInitiales={{
              marque: vehicule.marque,
              modele: vehicule.modele ?? "",
              annee: vehicule.annee ? String(vehicule.annee) : "",
              plaque: vehicule.plaque ?? "",
              vin: vehicule.vin ?? "",
              couleur: vehicule.couleur ?? "",
            }}
            onSucces={() => {
              setShowEdit(false);
              charger();
            }}
            onAnnuler={() => setShowEdit(false)}
          />
        </Modale>
      )}

      {showTransfert && client && (
        <ModaleTransfert
          vehicule={vehicule}
          clientActuel={client}
          surFermeture={() => setShowTransfert(false)}
          surSucces={() => {
            setShowTransfert(false);
            charger();
          }}
        />
      )}

      {showSupprimer && (
        <ModaleConfirmation
          titre="Supprimer ce véhicule ?"
          message="Cette action est irréversible."
          surConfirmation={async () => {
            const { error } = await supabase.from("vehicules").delete().eq("id", vehicule.id);
            if (!error) router.push(client ? `/clients/${client.id}` : "/clients");
            return { error: error?.message ?? null };
          }}
          surFermeture={() => setShowSupprimer(false)}
        />
      )}
    </div>
  );
}

function Detail({ titre, valeur }: { titre: string; valeur: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-mf-text-3">{titre}</dt>
      <dd className="mt-0.5 text-mf-text">{valeur}</dd>
    </div>
  );
}

// Transfert de propriétaire : ne touche que vehicules.client_id. Les bons
// de travail passés gardent leur propre client_id figé à leur création
// (jamais dérivé du véhicule) — l'historique reste donc automatiquement
// attribué au bon propriétaire de l'époque, sans rien à faire de plus.
function ModaleTransfert({
  vehicule,
  clientActuel,
  surFermeture,
  surSucces,
}: {
  vehicule: Vehicule;
  clientActuel: Client;
  surFermeture: () => void;
  surSucces: () => void;
}) {
  const supabase = createClient();
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState("");
  const [clientChoisi, setClientChoisi] = useState<Client | null>(null);
  const [enEnvoi, setEnEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, nom")
      .neq("id", clientActuel.id)
      .order("nom")
      .then(({ data }) => setClients(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clientsFiltres = clients.filter((c) => c.nom.toLowerCase().includes(q.toLowerCase()));

  async function confirmer() {
    if (!clientChoisi) return;
    setEnEnvoi(true);
    setErreur(null);
    const { error } = await supabase
      .from("vehicules")
      .update({ client_id: clientChoisi.id })
      .eq("id", vehicule.id);
    setEnEnvoi(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    surSucces();
  }

  return (
    <Modale titre={`Transférer ${vehicule.marque} ${vehicule.modele ?? ""}`} surFermeture={surFermeture}>
      <p className="text-sm text-mf-text-2 mb-4">
        Ce véhicule appartient actuellement à <b className="text-mf-text">{clientActuel.nom}</b>. Les bons de travail déjà faits restent
        attribués à leur propriétaire d'époque — seuls les nouveaux bons seront rattachés au nouveau client.
      </p>

      {!clientChoisi ? (
        <>
          <div className="relative mb-2">
            <Search className="w-4 h-4 text-mf-text-3 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              placeholder="Rechercher un client..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm pl-9 pr-3 py-2 text-sm text-mf-text min-h-[44px] focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft"
            />
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-mf-border border border-mf-border rounded-mf-sm">
            {clientsFiltres.length === 0 ? (
              <p className="text-sm text-mf-text-2 px-3 py-4">Aucun client trouvé.</p>
            ) : (
              clientsFiltres.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientChoisi(c)}
                  className="w-full text-left px-3 py-2.5 text-sm text-mf-text hover:bg-mf-surface-2 min-h-[44px]"
                >
                  {c.nom}
                </button>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="bg-mf-blue-soft border border-mf-border-strong rounded-mf-sm px-4 py-3 text-sm text-mf-text mb-2">
          Nouveau propriétaire : <b>{clientChoisi.nom}</b>
          <button
            type="button"
            onClick={() => setClientChoisi(null)}
            className="ml-2 text-mf-blue-hover hover:underline text-xs font-semibold"
          >
            Changer
          </button>
        </div>
      )}

      {erreur && <MessageErreur className="mt-3">{erreur}</MessageErreur>}

      <div className="flex justify-end gap-2 mt-5">
        <Bouton variante="secondaire" onClick={surFermeture}>
          Annuler
        </Bouton>
        <Bouton onClick={confirmer} enEnvoi={enEnvoi} disabled={!clientChoisi}>
          Confirmer le transfert
        </Bouton>
      </div>
    </Modale>
  );
}
