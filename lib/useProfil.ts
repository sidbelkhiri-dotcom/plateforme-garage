"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Role = "admin" | "reception" | "mecanicien";

export type Profil = {
  id: string;
  nom: string;
  role: Role;
  actif: boolean;
  garage_id: string | null;
};

// Le rôle du compte connecté, côté client — sert seulement à adapter
// l'affichage (cacher un bouton qui échouerait de toute façon). La vraie
// autorisation vit dans la RLS (D3), jamais ici.
export function useProfil() {
  const supabase = createClient();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let actif = true;

    // Requête du profil pour un utilisateur donné, avec quelques
    // tentatives si Supabase répond un hoquet passager — sans ça, un
    // simple raté laissait `profil` bloqué pour de bon (c'était le tout
    // premier bug : Paramètres invisible jusqu'à un rafraîchissement).
    async function chargerProfil(userId: string, tentative = 0) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, nom, role, actif, garage_id")
          .eq("id", userId)
          .single();
        if (!actif) return;
        if (error) throw error;
        setProfil(data as Profil);
        setChargement(false);
      } catch {
        if (!actif) return;
        if (tentative < 4) {
          setTimeout(() => chargerProfil(userId, tentative + 1), 500);
        } else {
          setChargement(false);
        }
      }
    }

    // onAuthStateChange, pas juste un getUser() au montage : la barre
    // latérale ne se démonte jamais entre deux pages (elle vit dans le
    // layout racine), donc un useEffect([]) classique ne se relançait
    // jamais après une déconnexion/reconnexion avec un AUTRE compte dans
    // le même onglet — le rôle de l'ancien utilisateur restait affiché
    // (Paramètres visible pour un compte mécanicien qui vient de se
    // connecter après un administrateur). onAuthStateChange se déclenche
    // à chaque connexion/déconnexion, et une fois immédiatement avec
    // l'état actuel — il couvre aussi le tout premier chargement.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!actif) return;
      if (session?.user) {
        chargerProfil(session.user.id);
      } else {
        setProfil(null);
        setChargement(false);
      }
    });

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peutGererClients = profil?.role === "admin" || profil?.role === "reception";
  const estAdmin = profil?.role === "admin";
  // Même ensemble de rôles que peutGererClients (admin/reception), nommé
  // différemment pour que les pages de bons de travail restent lisibles —
  // la vraie protection vit dans la RLS et le trigger D25, pas ici.
  const peutAutoriser = peutGererClients;

  return { profil, chargement, peutGererClients, estAdmin, peutAutoriser };
}
