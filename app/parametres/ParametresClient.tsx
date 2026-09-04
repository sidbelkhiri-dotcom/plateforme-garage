"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, ShieldQuestion, Wrench as WrenchIcon, UserCog, Star } from "lucide-react";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";
import Badge, { type ToneBadge } from "@/components/ui/Badge";

type Parametres = {
  nom: string;
  adresse: string | null;
  telephone: string | null;
  courriel: string | null;
  tps: string | null;
  tvq: string | null;
  taux_horaire: number;
  validite_evaluation_jours: number;
  garantie_mois: number;
  garantie_km: number;
  lien_avis_google: string | null;
};

type Profil = {
  id: string;
  nom: string;
  role: "admin" | "reception" | "mecanicien";
  actif: boolean;
};

const TON_ROLE: Record<Profil["role"], ToneBadge> = {
  admin: "ambre",
  reception: "ardoise",
  mecanicien: "ardoise",
};

const LABEL_ROLE: Record<Profil["role"], string> = {
  admin: "Administrateur",
  reception: "Réception",
  mecanicien: "Mécanicien",
};

export default function ParametresClient({
  parametresInitial,
  profilsInitial,
  monId,
}: {
  parametresInitial: Parametres | null;
  profilsInitial: Profil[];
  monId: string;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [valeurs, setValeurs] = useState<Parametres>(
    parametresInitial ?? {
      nom: "",
      adresse: "",
      telephone: "",
      courriel: "",
      tps: "",
      tvq: "",
      taux_horaire: 0,
      validite_evaluation_jours: 30,
      garantie_mois: 3,
      garantie_km: 5000,
      lien_avis_google: "",
    }
  );
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [profils, setProfils] = useState(profilsInitial);
  const [erreurRoles, setErreurRoles] = useState<string | null>(null);

  function definir<K extends keyof Parametres>(champ: K, val: Parametres[K]) {
    setValeurs((v) => ({ ...v, [champ]: val }));
    setEnregistre(false);
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    const { error } = await supabase
      .from("parametres")
      .update({
        nom: valeurs.nom,
        adresse: valeurs.adresse || null,
        telephone: valeurs.telephone || null,
        courriel: valeurs.courriel || null,
        tps: valeurs.tps || null,
        tvq: valeurs.tvq || null,
        taux_horaire: Number(valeurs.taux_horaire) || 0,
        validite_evaluation_jours: Number(valeurs.validite_evaluation_jours) || 30,
        garantie_mois: Number(valeurs.garantie_mois) || 3,
        garantie_km: Number(valeurs.garantie_km) || 5000,
        lien_avis_google: valeurs.lien_avis_google || null,
      })
      // Supabase/PostgREST exige un filtre explicite sur un update, même
      // quand la RLS restreint déjà à une seule ligne (garage_actuel()) —
      // sans ça : "UPDATE requires a WHERE clause". garage_id n'est
      // jamais null, donc ce filtre ne change rien à la ligne visée, il
      // satisfait juste cette exigence.
      .not("garage_id", "is", null);
    setEnregistrement(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    setEnregistre(true);
    router.refresh();
  }

  async function changerRole(profil: Profil, role: Profil["role"]) {
    setErreurRoles(null);
    const avant = profils;
    setProfils((p) => p.map((x) => (x.id === profil.id ? { ...x, role } : x)));
    const { error } = await supabase.from("profiles").update({ role }).eq("id", profil.id);
    if (error) {
      setProfils(avant);
      setErreurRoles(error.message);
    }
  }

  async function renommer(profil: Profil, nom: string) {
    const nomPropre = nom.trim();
    if (!nomPropre || nomPropre === profil.nom) return;
    setErreurRoles(null);
    const avant = profils;
    setProfils((p) => p.map((x) => (x.id === profil.id ? { ...x, nom: nomPropre } : x)));
    const { error } = await supabase.from("profiles").update({ nom: nomPropre }).eq("id", profil.id);
    if (error) {
      setProfils(avant);
      setErreurRoles(error.message);
    }
  }

  async function basculerActif(profil: Profil) {
    setErreurRoles(null);
    const avant = profils;
    setProfils((p) => p.map((x) => (x.id === profil.id ? { ...x, actif: !x.actif } : x)));
    const { error } = await supabase.from("profiles").update({ actif: !profil.actif }).eq("id", profil.id);
    if (error) {
      setProfils(avant);
      setErreurRoles(error.message);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-display font-black uppercase tracking-wide mb-1 text-mf-text">Paramètres</h1>
      <p className="text-sm text-mf-text-2 mb-6">Réservé à l'administrateur.</p>

      <form onSubmit={enregistrer} className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-6 flex flex-col gap-3">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-1 text-mf-text">
          <Building2 className="w-4 h-4" /> Coordonnées du garage
        </h2>
        <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
        <Champ label="Adresse" value={valeurs.adresse ?? ""} onChange={(e) => definir("adresse", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Téléphone" value={valeurs.telephone ?? ""} onChange={(e) => definir("telephone", e.target.value)} />
          <Champ label="Courriel" type="email" value={valeurs.courriel ?? ""} onChange={(e) => definir("courriel", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Numéro TPS" value={valeurs.tps ?? ""} onChange={(e) => definir("tps", e.target.value)} />
          <Champ label="Numéro TVQ" value={valeurs.tvq ?? ""} onChange={(e) => definir("tvq", e.target.value)} />
        </div>

        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mt-3 mb-1 text-mf-text">
          <WrenchIcon className="w-4 h-4" /> Atelier
        </h2>
        <Champ
          label="Taux horaire de main-d'œuvre ($/h)"
          type="number"
          step="0.01"
          value={String(valeurs.taux_horaire)}
          onChange={(e) => definir("taux_horaire", Number(e.target.value) as any)}
        />
        <div className="grid grid-cols-3 gap-3">
          <Champ
            label="Validité évaluation (jours)"
            type="number"
            value={String(valeurs.validite_evaluation_jours)}
            onChange={(e) => definir("validite_evaluation_jours", Number(e.target.value) as any)}
          />
          <Champ
            label="Garantie (mois)"
            type="number"
            value={String(valeurs.garantie_mois)}
            onChange={(e) => definir("garantie_mois", Number(e.target.value) as any)}
          />
          <Champ
            label="Garantie (km)"
            type="number"
            value={String(valeurs.garantie_km)}
            onChange={(e) => definir("garantie_km", Number(e.target.value) as any)}
          />
        </div>

        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mt-3 mb-1 text-mf-text">
          <Star className="w-4 h-4" /> Avis Google
        </h2>
        <Champ
          label="Lien vers la fiche Google du garage"
          value={valeurs.lien_avis_google ?? ""}
          onChange={(e) => definir("lien_avis_google", e.target.value)}
        />
        <p className="text-xs text-mf-text-3 -mt-2">
          Utilisé par le bouton « Demander un avis » sur une facture — cherchez votre garage sur Google, cliquez «
          Rédiger un avis », et copiez l'URL affichée.
        </p>

        {erreur && <MessageErreur>{erreur}</MessageErreur>}
        <Bouton type="submit" enEnvoi={enregistrement} className="w-fit mt-1">
          {enregistre ? "Enregistré ✓" : "Enregistrer"}
        </Bouton>
      </form>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-1 text-mf-text">
          <UserCog className="w-4 h-4" /> Utilisateurs et rôles
        </h2>
        <p className="text-xs text-mf-text-3 mb-4">
          Pour ajouter un nouvel employé, créez son compte dans Supabase (Authentication → Users → Add user) — il
          apparaîtra ici avec le rôle « Mécanicien » par défaut.
        </p>
        {erreurRoles && <MessageErreur className="mb-3">{erreurRoles}</MessageErreur>}
        <div className="divide-y divide-mf-border">
          {profils.map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <input
                  key={p.id + p.nom}
                  defaultValue={p.nom}
                  onBlur={(e) => renommer(p, e.target.value)}
                  aria-label={`Nom de ${p.nom}`}
                  title="Cliquer pour modifier le nom"
                  className="text-sm font-medium text-mf-text bg-transparent border-b border-dashed border-mf-border-strong hover:border-mf-blue-hover focus:border-solid focus:border-mf-blue focus:outline-none min-w-0 w-32 px-0.5 -ml-0.5"
                />
                {p.id === monId && <span className="text-xs text-mf-text-3">(vous)</span>}
                {!p.actif && <Badge tone="rouge">Inactif</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Selecteur
                  label=""
                  value={p.role}
                  disabled={p.id === monId}
                  onChange={(e) => changerRole(p, e.target.value as Profil["role"])}
                  className="min-h-[36px] py-1"
                >
                  <option value="admin">Administrateur</option>
                  <option value="reception">Réception</option>
                  <option value="mecanicien">Mécanicien</option>
                </Selecteur>
                <Badge tone={TON_ROLE[p.role]}>{LABEL_ROLE[p.role]}</Badge>
                {p.id !== monId && (
                  <button
                    onClick={() => basculerActif(p)}
                    className="text-xs font-semibold text-mf-text-3 hover:text-mf-text min-h-[36px] px-2"
                  >
                    {p.actif ? "Désactiver" : "Réactiver"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-mf-text-3 mt-3 flex items-center gap-1.5">
          <ShieldQuestion className="w-3.5 h-3.5" /> Vous ne pouvez pas changer votre propre rôle — demandez à un
          autre administrateur si besoin.
        </p>
      </div>
    </div>
  );
}
