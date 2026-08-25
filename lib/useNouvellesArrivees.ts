"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/ToastProvider";

// Nombre de demandes d'accueil en attente (statut 'nouvelle'), tenu à
// jour en temps réel via Supabase Realtime — voir migration
// 2026-08-17_realtime_demandes_accueil.sql. Toast à chaque nouvelle
// arrivée ; le compte suit aussi les validations/ignorances faites
// depuis un autre poste, pas seulement celui-ci.
export function useNouvellesArrivees(actif: boolean): number {
  const [compte, setCompte] = useState(0);
  const { afficher } = useToast();

  useEffect(() => {
    if (!actif) {
      setCompte(0);
      return;
    }
    const supabase = createClient();

    supabase
      .from("demandes_accueil")
      .select("id", { count: "exact", head: true })
      .eq("statut", "nouvelle")
      .then(({ count }) => setCompte(count ?? 0));

    const canal = supabase
      .channel("demandes_accueil_notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "demandes_accueil" },
        (payload: any) => {
          setCompte((c) => c + 1);
          afficher({
            titre: "Nouvelle arrivée",
            description: payload.new?.nom ? `${payload.new.nom} vient de s'enregistrer.` : "Un client vient de s'enregistrer.",
            severite: "info",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "demandes_accueil" },
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
