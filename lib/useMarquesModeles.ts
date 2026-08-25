"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Alimente les menus déroulants marque/modèle depuis les données
// moissonnées (vPIC + correctifs canadiens) — voir migration
// 2026-08-13_ref_vehicule_ymm.sql. Partagé entre le formulaire véhicule
// et la borne d'enregistrement client (/accueil).

export function useMarques(): string[] {
  const [marques, setMarques] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_marques")
      .select("marque")
      .then(({ data }) => setMarques((data ?? []).map((r) => r.marque)));
  }, []);

  return marques;
}

export function useModeles(marque: string): string[] {
  const [modeles, setModeles] = useState<string[]>([]);

  useEffect(() => {
    if (!marque) {
      setModeles([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("ref_vehicule_ymm")
      .select("modele")
      .eq("marque", marque)
      .then(({ data }) => {
        setModeles(Array.from(new Set((data ?? []).map((r) => r.modele))).sort());
      });
  }, [marque]);

  return modeles;
}

// Les années sont propres à un couple marque/modèle (contrainte unique
// (marque, modele, annee) sur ref_vehicule_ymm, moissonnée depuis vPIC) —
// pas une liste indépendante, donc dépend des deux, comme modèle dépend
// de marque.
export function useAnnees(marque: string, modele: string): number[] {
  const [annees, setAnnees] = useState<number[]>([]);

  useEffect(() => {
    if (!marque || !modele) {
      setAnnees([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("ref_vehicule_ymm")
      .select("annee")
      .eq("marque", marque)
      .eq("modele", modele)
      .then(({ data }) => {
        setAnnees(Array.from(new Set((data ?? []).map((r) => r.annee))).sort((a, b) => b - a));
      });
  }, [marque, modele]);

  return annees;
}
