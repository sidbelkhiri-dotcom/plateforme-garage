"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Phone, Mail, Car, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import Modale from "@/components/ui/Modale";
import ModaleConfirmation from "@/components/ui/ModaleConfirmation";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
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
  marque: string | null;
  modele: string | null;
  annee: number | null;
  service: string | null;
  date_souhaitee: string | null;
  plage: string | null;
  message: string | null;
};

type ValeursValidation = {
  nom: string;
  telephone: string;
  courriel: string;
  marque: string;
  modele: string;
  annee: string;
  date: string;
  heure: string;
  duree_min: string;
  description: string;
};

const LABEL_PLAGE: Record<string, string> = {
  matin: "Matin",
  apres_midi: "Après-midi",
  flexible: "Peu importe",
};

// Traitement des demandes venues du formulaire public du site web. Comme
// pour la borne d'accueil, rien n'atterrit jamais automatiquement dans le
// calendrier : la réception rappelle le client, fixe l'heure réelle, puis
// valide — c'est seulement là que le rendez-vous et le client sont créés.
export default function PageDemandesRendezVous() {
  const supabase = createClient();
  const router = useRouter();
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [chargement, setChargement] = useState(true);
  const [aValider, setAValider] = useState<Demande | null>(null);
  const [aIgnorer, setAIgnorer] = useState<Demande | null>(null);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data } = await supabase
      .from("demandes_rendez_vous")
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
        <h1 className="text-xl font-display font-black uppercase tracking-wide text-mf-text">
          Demandes de rendez-vous
        </h1>
        <p className="text-sm text-mf-text-2">
          {demandes.length} demande(s) en attente · reçues depuis le site web
        </p>
      </div>

      {chargement ? (
        <Chargement />
      ) : demandes.length === 0 ? (
        <EtatVide
          icone={CalendarClock}
          titre="Aucune demande en attente"
          message="Les demandes envoyées depuis le site web apparaîtront ici."
        />
      ) : (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border divide-y divide-mf-border">
          {demandes.map((d) => (
            <div key={d.id} className="px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-sm font-medium text-mf-text">
                  {d.nom}
                  {d.service && <span className="text-mf-text-3 font-normal"> · {d.service}</span>}
                </div>
                <div className="text-xs text-mf-text-3 flex items-center gap-3 flex-wrap mt-0.5">
                  {d.telephone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {d.telephone}
                    </span>
                  )}
                  {d.courriel && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {d.courriel}
                    </span>
                  )}
                  {(d.marque || d.modele) && (
                    <span className="flex items-center gap-1">
                      <Car className="w-3 h-3" /> {[d.marque, d.modele, d.annee].filter(Boolean).join(" ")}
                    </span>
                  )}
                </div>
                {(d.date_souhaitee || d.plage) && (
                  <div className="text-xs text-mf-blue-hover flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Souhaite&nbsp;: {d.date_souhaitee ? formatDateLong(d.date_souhaitee) : "date non précisée"}
                    {d.plage && ` · ${LABEL_PLAGE[d.plage] ?? d.plage}`}
                  </div>
                )}
                {d.message && (
                  <div className="text-xs text-mf-text-2 mt-1 max-w-md">« {d.message} »</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Bouton variante="secondaire" onClick={() => setAIgnorer(d)}>
                  Ignorer
                </Bouton>
                <Bouton onClick={() => setAValider(d)}>Valider</Bouton>
              </div>
            </div>
          ))}
        </div>
      )}

      {aValider && (
        <ModaleValidation
          demande={aValider}
          surFermeture={() => setAValider(null)}
          surSucces={() => {
            setAValider(null);
            charger();
            router.push("/rendez-vous");
          }}
        />
      )}

      {aIgnorer && (
        <ModaleConfirmation
          titre="Ignorer cette demande ?"
          message={`La demande de ${aIgnorer.nom} sera retirée de la liste, sans créer de rendez-vous.`}
          libelleConfirmation="Ignorer"
          surFermeture={() => setAIgnorer(null)}
          surConfirmation={async () => {
            const { error } = await supabase
              .from("demandes_rendez_vous")
              .update({ statut: "ignoree" })
              .eq("id", aIgnorer.id);
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
  surSucces: () => void;
}) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<ValeursValidation>({
    nom: demande.nom,
    telephone: demande.telephone ?? "",
    courriel: demande.courriel ?? "",
    marque: demande.marque ?? "",
    modele: demande.modele ?? "",
    annee: demande.annee ? String(demande.annee) : "",
    // La date souhaitée n'est qu'un souhait : la réception confirme
    // l'heure réelle au téléphone avant de valider.
    date: demande.date_souhaitee ?? todayLocal(),
    heure: demande.plage === "apres_midi" ? "13:00" : "09:00",
    duree_min: "60",
    description: demande.service || demande.message || "Rendez-vous",
  });
  const [clientExistant, setClientExistant] = useState<{ id: string; nom: string } | null>(null);
  const [lierClientExistant, setLierClientExistant] = useState(true);

  // Même détection que pour la borne d'accueil : un client qui revient ne
  // doit pas se retrouver en double dans la base.
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

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    const reussi = await soumettre(async () => {
      let clientId: string;
      if (clientExistant && lierClientExistant) {
        clientId = clientExistant.id;
      } else {
        const { data: client, error: erreurClient } = await supabase
          .from("clients")
          .insert({
            nom: valeurs.nom.trim(),
            telephone: valeurs.telephone || null,
            email: valeurs.courriel || null,
          })
          .select("id")
          .single();
        if (erreurClient || !client) return { error: { message: erreurClient?.message ?? "Erreur inconnue." } };
        clientId = client.id;
      }

      // Véhicule rattaché seulement si le client en a précisé un, et
      // seulement s'il ne l'a pas déjà — sinon un habitué se retrouverait
      // avec le même véhicule en double à chaque rendez-vous.
      let vehiculeId: string | null = null;
      if (valeurs.marque.trim()) {
        const { data: existant } = await supabase
          .from("vehicules")
          .select("id")
          .eq("client_id", clientId)
          .ilike("marque", valeurs.marque.trim())
          .ilike("modele", valeurs.modele.trim() || "%")
          .limit(1)
          .maybeSingle();

        if (existant) {
          vehiculeId = existant.id;
        } else {
          const { data: vehicule, error: erreurVehicule } = await supabase
            .from("vehicules")
            .insert({
              client_id: clientId,
              marque: valeurs.marque.trim(),
              modele: valeurs.modele.trim() || null,
              annee: valeurs.annee ? Number(valeurs.annee) : null,
            })
            .select("id")
            .single();
          if (erreurVehicule) return { error: { message: erreurVehicule.message } };
          vehiculeId = vehicule?.id ?? null;
        }
      }

      const { error: erreurRdv } = await supabase.from("rendez_vous").insert({
        client_id: clientId,
        vehicule_id: vehiculeId,
        date: valeurs.date,
        heure: valeurs.heure,
        duree_min: Number(valeurs.duree_min) || 60,
        description: valeurs.description.trim(),
        statut: "confirme",
      });
      if (erreurRdv) return { error: { message: erreurRdv.message } };

      const { error: erreurStatut } = await supabase
        .from("demandes_rendez_vous")
        .update({ statut: "traitee" })
        .eq("id", demande.id);
      if (erreurStatut) return { error: { message: erreurStatut.message } };

      return { error: null };
    });
    if (reussi) surSucces();
  }

  return (
    <Modale titre="Valider la demande de rendez-vous" surFermeture={surFermeture}>
      <form onSubmit={valider} className="flex flex-col gap-3">
        {(demande.date_souhaitee || demande.plage || demande.message) && (
          <div className="bg-mf-surface-3 border border-mf-border rounded-mf-sm px-3 py-2.5 text-xs text-mf-text-2">
            <div className="font-semibold text-mf-text mb-1">Ce que le client a demandé</div>
            {demande.date_souhaitee && (
              <div>
                Date souhaitée : {formatDateLong(demande.date_souhaitee)}
                {demande.plage && ` · ${LABEL_PLAGE[demande.plage] ?? demande.plage}`}
              </div>
            )}
            {demande.service && <div>Service : {demande.service}</div>}
            {demande.message && <div className="mt-1">« {demande.message} »</div>}
            <div className="mt-1.5 text-mf-text-3">
              Confirmez l&rsquo;heure avec le client par téléphone avant de valider.
            </div>
          </div>
        )}

        {clientExistant && (
          <label className="flex items-start gap-3 text-sm bg-mf-blue-soft border border-mf-blue rounded-mf-sm px-3 py-2.5">
            <input
              type="checkbox"
              checked={lierClientExistant}
              onChange={(e) => setLierClientExistant(e.target.checked)}
              className="w-5 h-5 mt-0.5 shrink-0"
            />
            <span className="text-mf-text">
              Client existant trouvé : <strong>{clientExistant.nom}</strong> — rattacher ce rendez-vous à sa
              fiche au lieu de créer un nouveau client.
            </span>
          </label>
        )}

        <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Téléphone" value={valeurs.telephone} onChange={(e) => definir("telephone", e.target.value)} />
          <Champ label="Courriel" value={valeurs.courriel} onChange={(e) => definir("courriel", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Champ label="Marque" value={valeurs.marque} onChange={(e) => definir("marque", e.target.value)} />
          <Champ label="Modèle" value={valeurs.modele} onChange={(e) => definir("modele", e.target.value)} />
          <Champ
            label="Année"
            type="number"
            value={valeurs.annee}
            onChange={(e) => definir("annee", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Champ
            label="Date"
            type="date"
            required
            value={valeurs.date}
            onChange={(e) => definir("date", e.target.value)}
          />
          <Champ
            label="Heure"
            type="time"
            required
            value={valeurs.heure}
            onChange={(e) => definir("heure", e.target.value)}
          />
          <Selecteur
            label="Durée"
            value={valeurs.duree_min}
            onChange={(e) => definir("duree_min", e.target.value)}
          >
            <option value="30">30 min</option>
            <option value="60">1 h</option>
            <option value="90">1 h 30</option>
            <option value="120">2 h</option>
            <option value="180">3 h</option>
            <option value="240">4 h</option>
          </Selecteur>
        </div>

        <Champ
          label="Motif"
          required
          value={valeurs.description}
          onChange={(e) => definir("description", e.target.value)}
        />

        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        <div className="flex justify-end gap-2 mt-1">
          <Bouton type="button" variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
          <Bouton type="submit" enEnvoi={enEnvoi}>
            Créer le rendez-vous
          </Bouton>
        </div>
      </form>
    </Modale>
  );
}
