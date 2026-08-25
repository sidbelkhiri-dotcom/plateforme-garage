"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Alimente le menu déroulant de pièces du formulaire d'inventaire depuis
// le catalogue générique — voir migration 2026-08-16_ref_pieces.sql.
// Même patron que useMarques/useModeles (lib/useMarquesModeles.ts).

export function useCategoriesPieces(): string[] {
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("ref_categories_pieces")
      .select("categorie")
      .then(({ data }) => setCategories((data ?? []).map((r) => r.categorie)));
  }, []);

  return categories;
}

export function usePieces(categorie: string): string[] {
  const [pieces, setPieces] = useState<string[]>([]);

  useEffect(() => {
    if (!categorie) {
      setPieces([]);
      return;
    }
    const supabase = createClient();
    supabase
      .from("ref_pieces")
      .select("nom")
      .eq("categorie", categorie)
      .order("nom")
      .then(({ data }) => setPieces((data ?? []).map((r) => r.nom)));
  }, [categorie]);

  return pieces;
}
