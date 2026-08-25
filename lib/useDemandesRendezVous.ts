"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";

// Nombre de demandes de rendez-vous en attente, tenu à jour en temps réel
// — même mécanisme que useNouvellesArrivees, sur la table alimentée par le
// formulaire public du site web (voir migration
// 2026-08-23_demandes_rendez_vous.sql).
//
// Volontairement distinct des nouvelles arrivées : une arrivée, c'est un
// client debout au comptoir maintenant ; une demande de rendez-vous, c'est
// quelqu'un à rappeler dans l'heure. Deux urgences différentes, deux
// compteurs.
export function useDemandesRendezVous(actif: boolean): number {
  const [compte, setCompte] = useState(0);
  const { afficher } = useToast();

  useEffect(() => {
    if (!actif) {
      setCompte(0);
      return;
    }
    const supabase = createClient();

    supabase
      .from("demandes_rendez_vous")
      .select("id", { count: "exact", head: true })
      .eq("statut", "nouvelle")
      .then(({ count }) => setCompte(count ?? 0));

    const canal = supabase
      .channel("demandes_rdv_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "demandes_rendez_vous" },
        (payload: any) => {
          setCompte((c) => c + 1);
          afficher({
            titre: "Demande de rendez-vous",
            description: payload.new?.nom
              ? `${payload.new.nom} a fait une demande depuis le site web.`
              : "Nouvelle demande depuis le site web.",
            severite: "info",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "demandes_rendez_vous" },
        (payload: any) => {
          if (payload.old?.statut === "nouvelle" && payload.new?.statut !== "nouvelle") {
            setCompte((c) => Math.max(0, c - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [actif]);

  return compte;
}
