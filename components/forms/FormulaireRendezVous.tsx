"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { useToast } from "@/components/ui/ToastProvider";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";

export type RdvStatut = "prevu" | "confirme" | "en_cours" | "termine" | "annule" | "absent";

export const STATUTS_RDV: { value: RdvStatut; label: string }[] = [
  { value: "prevu", label: "Prévu" },
  { value: "confirme", label: "Confirmé" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "annule", label: "Annulé" },
  { value: "absent", label: "Client absent" },
];

type RdvValeurs = {
  client_id: string;
  vehicule_id: string;
  employe_id: string;
  date: string;
  heure: string;
  duree_min: string;
  description: string;
  statut: RdvStatut;
};

export default function FormulaireRendezVous({
  rdvId,
  valeursInitiales,
  onSucces,
  onAnnuler,
}: {
  rdvId?: string;
  valeursInitiales?: Partial<RdvValeurs>;
  onSucces: () => void;
  onAnnuler: () => void;
}) {
  const supabase = createClient();
  const { afficher } = useToast();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<RdvValeurs>({
    client_id: "",
    vehicule_id: "",
    employe_id: "",
    date: "",
    heure: "09:00",
    duree_min: "60",
    description: "",
    statut: "prevu",
    ...valeursInitiales,
  });

  const [clients, setClients] = useState<{ id: string; nom: string }[]>([]);
  const [vehicules, setVehicules] = useState<{ id: string; marque: string; modele: string | null }[]>([]);
  const [mecaniciens, setMecaniciens] = useState<{ id: string; nom: string }[]>([]);

  useEffect(() => {
    supabase
      .from("clients")
      .select("id, nom")
      .order("nom")
      .then(({ data }) => setClients(data ?? []));
    supabase
      .from("profiles")
      .select("id, nom")
      .eq("actif", true)
      .order("nom")
      .then(({ data }) => setMecaniciens(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!valeurs.client_id) {
      setVehicules([]);
      return;
    }
    supabase
      .from("vehicules")
      .select("id, marque, modele")
      .eq("client_id", valeurs.client_id)
      .then(({ data }) => setVehicules(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeurs.client_id]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const donnees = {
      client_id: valeurs.client_id || null,
      vehicule_id: valeurs.vehicule_id || null,
      employe_id: valeurs.employe_id || null,
      date: valeurs.date,
      heure: valeurs.heure,
      duree_min: Number(valeurs.duree_min) || 60,
      description: valeurs.description.trim(),
      statut: valeurs.statut,
    };
    let nouveauRdvId: string | null = null;
    const reussi = await soumettre(async () => {
      if (rdvId) {
        return await supabase.from("rendez_vous").update(donnees).eq("id", rdvId);
      }
      const resultat = await supabase.from("rendez_vous").insert(donnees).select("id").single();
      nouveauRdvId = resultat.data?.id ?? null;
      return resultat;
    });
    if (reussi) {
      if (nouveauRdvId && donnees.client_id) {
        envoyerConfirmationAutomatiquement(nouveauRdvId);
      }
      onSucces();
    }
  }

  // Best-effort, comme le devis sur les bons de travail : ne bloque
  // jamais la création du rendez-vous (ex. client sans courriel).
  async function envoyerConfirmationAutomatiquement(id: string) {
    try {
      const reponse = await fetch("/api/envoyer-confirmation-rdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rdvId: id }),
      });
      const donnees = await reponse.json();
      if (reponse.ok) {
        afficher({ titre: "Confirmation envoyée au client", description: `Envoyée à ${donnees.envoyeeA}`, severite: "success" });
      } else {
        afficher({ titre: "Confirmation non envoyée", description: donnees.error, severite: "warning" });
      }
    } catch {
      afficher({ titre: "Confirmation non envoyée", description: "Erreur réseau.", severite: "warning" });
    }
  }

  return (
    <form onSubmit={envoyer} className="flex flex-col gap-3">
      <Selecteur
        label="Client"
        value={valeurs.client_id}
        onChange={(e) => {
          definir("client_id", e.target.value);
          definir("vehicule_id", "");
        }}
      >
        <option value="">— Aucun / walk-in —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nom}
          </option>
        ))}
      </Selecteur>

      {vehicules.length > 0 && (
        <Selecteur
          label="Véhicule"
          value={valeurs.vehicule_id}
          onChange={(e) => definir("vehicule_id", e.target.value)}
        >
          <option value="">— Non précisé —</option>
          {vehicules.map((v) => (
            <option key={v.id} value={v.id}>
              {v.marque} {v.modele ?? ""}
            </option>
          ))}
        </Selecteur>
      )}

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <Champ
        label="Durée estimée (minutes)"
        type="number"
        value={valeurs.duree_min}
        onChange={(e) => definir("duree_min", e.target.value)}
      />

      <Champ
        label="Motif"
        required
        placeholder="Ex. changement d'huile, freins..."
        value={valeurs.description}
        onChange={(e) => definir("description", e.target.value)}
      />

      <Selecteur
        label="Mécanicien assigné"
        value={valeurs.employe_id}
        onChange={(e) => definir("employe_id", e.target.value)}
      >
        <option value="">— Non assigné —</option>
        {mecaniciens.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nom}
          </option>
        ))}
      </Selecteur>

      <Selecteur
        label="Statut"
        value={valeurs.statut}
        onChange={(e) => definir("statut", e.target.value as RdvStatut)}
      >
        {STATUTS_RDV.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Selecteur>

      {erreur && <MessageErreur>{erreur}</MessageErreur>}
      <div className="flex justify-end gap-2 mt-1">
        <Bouton type="button" variante="secondaire" onClick={onAnnuler}>
          Annuler
        </Bouton>
        <Bouton type="submit" enEnvoi={enEnvoi}>
          {rdvId ? "Enregistrer" : "Créer le rendez-vous"}
        </Bouton>
      </div>
    </form>
  );
}
