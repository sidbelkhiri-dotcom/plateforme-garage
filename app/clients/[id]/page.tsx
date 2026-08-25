"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Plus, Car, Phone, Mail, MapPin, Pencil, Trash2, History, Camera, ShieldCheck } from "lucide-react";
import Modale from "@/components/ui/Modale";
import ModaleConfirmation from "@/components/ui/ModaleConfirmation";
import Bouton from "@/components/ui/Bouton";
import Badge from "@/components/ui/Badge";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import FormulaireClient from "@/components/forms/FormulaireClient";
import FormulaireVehicule from "@/components/forms/FormulaireVehicule";
import { useProfil } from "@/lib/useProfil";
import { formatDateLong } from "@/lib/dates";
import { urlSigneePhotoFacturePiece } from "@/lib/facturesPiecesPhotos";

type Client = {
  id: string;
  nom: string;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  code_postal: string | null;
  notes: string | null;
};

type Vehicule = {
  id: string;
  marque: string;
  modele: string | null;
  annee: number | null;
  plaque: string | null;
  vin: string | null;
  couleur: string | null;
};

type Bon = {
  id: string;
  numero: string;
  statut: string;
  vehicule_id: string | null;
  ouvert_le: string;
};

type PieceGarantie = {
  id: string;
  description: string;
  fournisseur: string | null;
  installee_le: string | null;
  photos_facture: string[];
  bon_travail_id: string;
  bon_numero: string;
};

const LABEL_STATUT: Record<string, string> = {
  evaluation: "Évaluation",
  autorise: "Autorisé",
  en_cours: "En cours",
  termine: "Terminé",
  facture: "Facturé",
  annule: "Annulé",
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { peutGererClients, estAdmin } = useProfil();

  const [client, setClient] = useState<Client | null>(null);
  const [vehicules, setVehicules] = useState<Vehicule[]>([]);
  const [bons, setBons] = useState<Bon[]>([]);
  const [piecesGarantie, setPiecesGarantie] = useState<PieceGarantie[]>([]);
  const [carte, setCarte] = useState<{ progression: number; offerts: number } | null>(null);
  const [urlsPhotos, setUrlsPhotos] = useState<Record<string, string>>({});
  const [chargement, setChargement] = useState(true);
  const [showEditClient, setShowEditClient] = useState(false);
  const [showAddVehicule, setShowAddVehicule] = useState(false);
  const [vehiculeEnEdition, setVehiculeEnEdition] = useState<Vehicule | null>(null);
  const [showSupprimerClient, setShowSupprimerClient] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const [{ data: c }, { data: v }, { data: b }, { data: cf }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase.from("vehicules").select("*").eq("client_id", id).order("created_at", { ascending: false }),
      supabase
        .from("bons_travail")
        .select("id, numero, statut, vehicule_id, ouvert_le")
        .eq("client_id", id)
        .order("ouvert_le", { ascending: false })
        .limit(10),
      supabase.from("cartes_fidelite").select("progression, offerts").eq("client_id", id).maybeSingle(),
    ]);
    setClient(c);
    setVehicules(v ?? []);
    setBons(b ?? []);
    setCarte(cf ?? null);

    const bonIds = (b ?? []).map((bon) => bon.id);
    if (bonIds.length > 0) {
      const { data: lignes } = await supabase
        .from("bon_travail_lignes")
        .select("id, description, fournisseur, installee_le, photos_facture, bon_travail_id")
        .eq("type", "piece")
        .in("bon_travail_id", bonIds);
      const numeroParBon = Object.fromEntries((b ?? []).map((bon) => [bon.id, bon.numero]));
      setPiecesGarantie(
        (lignes ?? [])
          .filter((l) => l.fournisseur || l.photos_facture.length > 0)
          .map((l) => ({ ...l, bon_numero: numeroParBon[l.bon_travail_id] }))
      );
    } else {
      setPiecesGarantie([]);
    }

    setChargement(false);
  }, [id, supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  useEffect(() => {
    const chemins = piecesGarantie.flatMap((p) => p.photos_facture);
    if (chemins.length === 0) return;
    let annule = false;
    Promise.all(chemins.map(async (chemin) => [chemin, await urlSigneePhotoFacturePiece(supabase, chemin)] as const)).then(
      (paires) => {
        if (annule) return;
        setUrlsPhotos(Object.fromEntries(paires.filter((p): p is [string, string] => p[1] !== null)));
      }
    );
    return () => {
      annule = true;
    };
  }, [piecesGarantie, supabase]);

  if (chargement) return <div className="p-6"><Chargement /></div>;
  if (!client) return <div className="p-6 text-sm text-mf-text-2">Client introuvable.</div>;

  return (
    <div className="p-6">
      <button
        onClick={() => router.push("/clients")}
        className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux clients
      </button>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">{client.nom}</h1>
          {peutGererClients && (
            <div className="flex gap-2">
              <Bouton variante="secondaire" onClick={() => setShowEditClient(true)}>
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </Bouton>
              {estAdmin && (
                <Bouton variante="danger" onClick={() => setShowSupprimerClient(true)}>
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </Bouton>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-sm text-mf-text-2">
          {client.telephone && (
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-mf-text-3" /> {client.telephone}
            </span>
          )}
          {client.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-mf-text-3" /> {client.email}
            </span>
          )}
          {(client.adresse || client.code_postal) && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-mf-text-3" />
              {[client.adresse, client.code_postal].filter(Boolean).join(", ")}
            </span>
          )}
        </div>
        {client.notes && <p className="text-sm text-mf-text-2 mt-3 border-t border-mf-border pt-3">{client.notes}</p>}

        {carte && (carte.progression > 0 || carte.offerts > 0) && (
          <div className="mt-3 border-t border-mf-border pt-3 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wide text-mf-text-3 font-semibold">
              Carte de fidélité
            </span>
            <span className="flex items-center gap-1" aria-label={`${Math.max(0, carte.progression)} sur 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < carte.progression ? "bg-mf-blue" : "bg-mf-surface-3 border border-mf-border-strong"
                  }`}
                />
              ))}
            </span>
            {carte.progression >= 5 ? (
              <span className="text-sm font-semibold text-mf-success">
                Prochain changement d&rsquo;huile offert
              </span>
            ) : (
              <span className="text-sm text-mf-text-2">
                {Math.max(0, carte.progression)} sur 5 avant la gratuité
              </span>
            )}
            {carte.offerts > 0 && (
              <span className="text-xs text-mf-text-3">
                · {carte.offerts} déjà offert{carte.offerts > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 text-mf-text">
          <Car className="w-4 h-4" /> Véhicules ({vehicules.length})
        </h2>
        {peutGererClients && (
          <Bouton variante="secondaire" onClick={() => setShowAddVehicule(true)}>
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </Bouton>
        )}
      </div>

      {vehicules.length === 0 ? (
        <EtatVide icone={Car} titre="Aucun véhicule" message="Ajoutez le premier véhicule de ce client." />
      ) : (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
          {vehicules.map((v) => (
            <div key={v.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <Link href={`/vehicules/${v.id}`} className="min-w-0">
                <div className="font-semibold text-sm text-mf-text">
                  {v.marque} {v.modele} {v.annee ? `(${v.annee})` : ""}
                </div>
                <div className="text-xs text-mf-text-3 flex flex-wrap gap-x-3 mt-0.5">
                  {v.plaque && <span>Plaque : {v.plaque}</span>}
                  {v.vin && <span>NIV : {v.vin}</span>}
                  {v.couleur && <span>{v.couleur}</span>}
                </div>
              </Link>
              {peutGererClients && (
                <button
                  onClick={() => setVehiculeEnEdition(v)}
                  className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center shrink-0"
                  aria-label="Modifier le véhicule"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
          <History className="w-4 h-4" /> Historique récent
        </h2>
        {bons.length === 0 ? (
          <p className="text-sm text-mf-text-2">Aucun bon de travail pour l'instant.</p>
        ) : (
          <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
            {bons.map((b) => {
              const v = vehicules.find((x) => x.id === b.vehicule_id);
              return (
                <Link
                  key={b.id}
                  href={`/bons-travail/${b.id}`}
                  className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-mf-surface-2 min-h-[44px]"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-sm font-semibold text-mf-text">{b.numero}</span>
                    {v && <span className="text-xs text-mf-text-3 ml-2">{v.marque} {v.modele}</span>}
                    <div className="text-xs text-mf-text-3">{formatDateLong(b.ouvert_le)}</div>
                  </div>
                  <Badge tone={b.statut === "termine" ? "emeraude" : b.statut === "annule" ? "rouge" : "ardoise"}>
                    {LABEL_STATUT[b.statut] ?? b.statut}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {piecesGarantie.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <ShieldCheck className="w-4 h-4" /> Pièces avec facture (garantie)
          </h2>
          <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
            {piecesGarantie.map((p) => (
              <div key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-mf-text">{p.description}</div>
                  <div className="text-xs text-mf-text-3 flex flex-wrap gap-x-2 mt-0.5">
                    {p.fournisseur && <span>Fournisseur : {p.fournisseur}</span>}
                    {p.installee_le && <span>Installée le {formatDateLong(p.installee_le)}</span>}
                    <Link href={`/bons-travail/${p.bon_travail_id}`} className="text-mf-blue-hover hover:text-mf-blue">
                      {p.bon_numero}
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {p.photos_facture.map((chemin) =>
                    urlsPhotos[chemin] ? (
                      <a key={chemin} href={urlsPhotos[chemin]} target="_blank" rel="noopener noreferrer">
                        <img
                          src={urlsPhotos[chemin]}
                          alt="Facture fournisseur"
                          className="w-14 h-11 object-cover rounded-mf-sm border border-mf-border hover:border-mf-blue"
                        />
                      </a>
                    ) : (
                      <div
                        key={chemin}
                        className="w-14 h-11 rounded-mf-sm border border-mf-border bg-mf-surface-3 flex items-center justify-center"
                      >
                        <Camera className="w-3.5 h-3.5 text-mf-text-3" />
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEditClient && (
        <Modale titre="Modifier le client" surFermeture={() => setShowEditClient(false)}>
          <FormulaireClient
            clientId={client.id}
            valeursInitiales={{
              nom: client.nom,
              telephone: client.telephone ?? "",
              email: client.email ?? "",
              adresse: client.adresse ?? "",
              codePostal: client.code_postal ?? "",
              notes: client.notes ?? "",
            }}
            onSucces={() => {
              setShowEditClient(false);
              charger();
            }}
            onAnnuler={() => setShowEditClient(false)}
          />
        </Modale>
      )}

      {showAddVehicule && (
        <Modale titre="Nouveau véhicule" surFermeture={() => setShowAddVehicule(false)}>
          <FormulaireVehicule
            clientId={client.id}
            onSucces={() => {
              setShowAddVehicule(false);
              charger();
            }}
            onAnnuler={() => setShowAddVehicule(false)}
          />
        </Modale>
      )}

      {vehiculeEnEdition && (
        <Modale titre="Modifier le véhicule" surFermeture={() => setVehiculeEnEdition(null)}>
          <FormulaireVehicule
            clientId={client.id}
            vehiculeId={vehiculeEnEdition.id}
            valeursInitiales={{
              marque: vehiculeEnEdition.marque,
              modele: vehiculeEnEdition.modele ?? "",
              annee: vehiculeEnEdition.annee ? String(vehiculeEnEdition.annee) : "",
              plaque: vehiculeEnEdition.plaque ?? "",
              vin: vehiculeEnEdition.vin ?? "",
              couleur: vehiculeEnEdition.couleur ?? "",
            }}
            onSucces={() => {
              setVehiculeEnEdition(null);
              charger();
            }}
            onAnnuler={() => setVehiculeEnEdition(null)}
          />
        </Modale>
      )}

      {showSupprimerClient && (
        <ModaleConfirmation
          titre="Supprimer ce client ?"
          message={`${client.nom} et ${vehicules.length} véhicule(s) associé(s) seront supprimés définitivement.`}
          surConfirmation={async () => {
            const { error } = await supabase.from("clients").delete().eq("id", client.id);
            if (!error) router.push("/clients");
            return { error: error?.message ?? null };
          }}
          surFermeture={() => setShowSupprimerClient(false)}
        />
      )}
    </div>
  );
}
