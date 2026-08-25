"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Phone, Car } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import Modale from "@/components/ui/Modale";
import ModaleConfirmation from "@/components/ui/ModaleConfirmation";
import Champ from "@/components/ui/Champ";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";
import Chargement from "@/components/ui/Chargement";
import EtatVide from "@/components/ui/EtatVide";
import { formatDateLong, todayLocal } from "@/lib/dates";

type Demande = {
  id: string;
  created_at: string;
  nom: string;
  telephone: string | null;
  courriel: string | null;
  adresse: string | null;
  code_postal: string | null;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  plaque: string | null;
  plainte: string | null;
};

type ValeursValidation = {
  nom: string;
  telephone: string;
  courriel: string;
  adresse: string;
  codePostal: string;
  marque: string;
  modele: string;
  annee: string;
  plaque: string;
};

// Traitement des demandes de la borne d'enregistrement (/accueil) : rien
// n'y arrive jamais automatiquement dans les vraies données, la
// réception valide (ou ignore) chaque demande une par une.
export default function PageDemandesAccueil() {
  const supabase = createClient();
  const router = useRouter();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [demandeAValider, setDemandeAValider] = useState<Demande | null>(null);
  const [demandeAIgnorer, setDemandeAIgnorer] = useState<Demande | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data } = await supabase
      .from("demandes_accueil")
      .select("*")
      .eq("statut", "nouvelle")
      .order("created_at", { ascending: true });
    setDemandes(data ?? []);
    setChargement(false);
  }, [supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">Nouvelles arrivées</h1>
        <p className="text-sm text-mf-text-2">{demandes.length} demande(s) en attente</p>
      </div>

      {chargement ? (
        <Chargement />
      ) : demandes.length === 0 ? (
        <EtatVide
          icone={UserPlus}
          titre="Aucune nouvelle demande"
          message="Les clients qui s'enregistrent via la borne d'accueil apparaîtront ici."
        />
      ) : (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
          {demandes.map((d) => (
            <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-mf-text">{d.nom}</div>
                <div className="text-xs text-mf-text-3 flex items-center gap-3 flex-wrap mt-0.5">
                  {d.telephone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {d.telephone}
                    </span>
                  )}
                  {(d.marque || d.modele) && (
                    <span className="flex items-center gap-1">
                      <Car className="w-3 h-3" /> {[d.marque, d.modele, d.annee].filter(Boolean).join(" ")}
                    </span>
                  )}
                </div>
                {d.plainte && <div className="text-xs text-mf-text-2 mt-1 truncate max-w-md">« {d.plainte} »</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Bouton variante="secondaire" onClick={() => setDemandeAIgnorer(d)}>
                  Ignorer
                </Bouton>
                <Bouton onClick={() => setDemandeAValider(d)}>Valider</Bouton>
              </div>
            </div>
          ))}
        </div>
      )}

      {demandeAValider && (
        <ModaleValidation
          demande={demandeAValider}
          surFermeture={() => setDemandeAValider(null)}
          surSucces={(clientId) => {
            setDemandeAValider(null);
            charger();
            router.push(`/clients/${clientId}`);
          }}
        />
      )}

      {demandeAIgnorer && (
        <ModaleConfirmation
          titre="Ignorer cette demande ?"
          message={`La demande de ${demandeAIgnorer.nom} sera retirée de la liste, sans créer de client.`}
          libelleConfirmation="Ignorer"
          surFermeture={() => setDemandeAIgnorer(null)}
          surConfirmation={async () => {
            const { error } = await supabase
              .from("demandes_accueil")
              .update({ statut: "ignoree" })
              .eq("id", demandeAIgnorer.id);
            if (!error) charger();
            return { error: error?.message ?? null };
          }}
        />
      )}
    </div>
  );
}

function ModaleValidation({
  demande,
  surFermeture,
  surSucces,
}: {
  demande: Demande;
  surFermeture: () => void;
  surSucces: (clientId: string) => void;
}) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<ValeursValidation>({
    nom: demande.nom,
    telephone: demande.telephone ?? "",
    courriel: demande.courriel ?? "",
    adresse: demande.adresse ?? "",
    codePostal: demande.code_postal ?? "",
    marque: demande.marque ?? "",
    modele: demande.modele ?? "",
    annee: demande.annee ? String(demande.annee) : "",
    plaque: demande.plaque ?? "",
  });
  const [clientExistant, setClientExistant] = useState<{ id: string; nom: string } | null>(null);
  const [lierClientExistant, setLierClientExistant] = useState(true);

  useEffect(() => {
    async function chercherDoublon() {
      const filtres: string[] = [];
      if (demande.telephone) filtres.push(`telephone.eq.${demande.telephone}`);
      if (demande.courriel) filtres.push(`email.eq.${demande.courriel}`);
      if (filtres.length === 0) return;
      const { data } = await supabase.from("clients").select("id, nom").or(filtres.join(",")).limit(1).maybeSingle();
      setClientExistant(data ?? null);
    }
    chercherDoublon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let clientIdCree: string | null = null;

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    const reussi = await soumettre(async () => {
      const noteVisite = demande.plainte
        ? `Raison de la visite (${formatDateLong(todayLocal())}) : ${demande.plainte}`
        : null;

      let clientId: string;
      if (clientExistant && lierClientExistant) {
        clientId = clientExistant.id;
        if (noteVisite) {
          const { data: clientActuel } = await supabase.from("clients").select("notes").eq("id", clientId).single();
          const notesAJour = clientActuel?.notes ? `${clientActuel.notes}\n\n${noteVisite}` : noteVisite;
          const { error: erreurNotes } = await supabase.from("clients").update({ notes: notesAJour }).eq("id", clientId);
          if (erreurNotes) return { error: { message: erreurNotes.message } };
        }
      } else {
        const { data: client, error: erreurClient } = await supabase
          .from("clients")
          .insert({
            nom: valeurs.nom.trim(),
            telephone: valeurs.telephone || null,
            email: valeurs.courriel || null,
            adresse: valeurs.adresse || null,
            code_postal: valeurs.codePostal || null,
            notes: noteVisite,
          })
          .select("id")
          .single();
        if (erreurClient || !client) return { error: { message: erreurClient?.message ?? "Erreur inconnue." } };
        clientId = client.id;
      }

      if (valeurs.marque) {
        const { error: erreurVehicule } = await supabase.from("vehicules").insert({
          client_id: clientId,
          marque: valeurs.marque.trim(),
          modele: valeurs.modele || null,
          annee: valeurs.annee ? Number(valeurs.annee) : null,
          plaque: valeurs.plaque || null,
        });
        if (erreurVehicule) return { error: { message: erreurVehicule.message } };
      }

      const { error: erreurStatut } = await supabase
        .from("demandes_accueil")
        .update({ statut: "traitee" })
        .eq("id", demande.id);
      if (erreurStatut) return { error: { message: erreurStatut.message } };

      clientIdCree = clientId;
      return { error: null };
    });
    if (reussi && clientIdCree) surSucces(clientIdCree);
  }

  return (
    <Modale titre="Valider la demande" surFermeture={surFermeture}>
      <form onSubmit={valider} className="flex flex-col gap-3">
        {clientExistant && (
          <label className="flex items-start gap-3 text-sm bg-mf-blue-soft border border-mf-blue rounded-mf-sm px-3 py-2.5">
            <input
              type="checkbox"
              checked={lierClientExistant}
              onChange={(e) => setLierClientExistant(e.target.checked)}
              className="w-5 h-5 mt-0.5 shrink-0"
            />
            <span className="text-mf-text">
              Client existant trouvé : <strong>{clientExistant.nom}</strong> — lier ce véhicule à sa fiche au lieu
              de créer un nouveau client.
            </span>
          </label>
        )}
        <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Téléphone" value={valeurs.telephone} onChange={(e) => definir("telephone", e.target.value)} />
          <Champ label="Courriel" value={valeurs.courriel} onChange={(e) => definir("courriel", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Adresse" value={valeurs.adresse} onChange={(e) => definir("adresse", e.target.value)} />
          <Champ label="Code postal" value={valeurs.codePostal} onChange={(e) => definir("codePostal", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Marque" value={valeurs.marque} onChange={(e) => definir("marque", e.target.value)} />
          <Champ label="Modèle" value={valeurs.modele} onChange={(e) => definir("modele", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Année"
            type="number"
            value={valeurs.annee}
            onChange={(e) => definir("annee", e.target.value)}
          />
          <Champ label="Plaque" value={valeurs.plaque} onChange={(e) => definir("plaque", e.target.value)} />
        </div>
        {demande.plainte && (
          <p className="text-xs text-mf-text-2 bg-mf-surface-3 border border-mf-border rounded-mf-sm px-3 py-2">
            Raison de la visite : « {demande.plainte} »
          </p>
        )}
        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        <div className="flex justify-end gap-2 mt-1">
          <Bouton type="button" variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
          <Bouton type="submit" enEnvoi={enEnvoi}>
            {clientExistant && lierClientExistant ? "Lier au client existant" : "Créer le client"}
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
