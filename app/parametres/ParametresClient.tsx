"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Building2, ShieldQuestion, Wrench as WrenchIcon, UserCog, Star, Globe, Copy, ExternalLink, Send, Mail } from "lucide-react";
import { formatDateHeure } from "@/lib/dates";
import { useToast } from "@/components/ui/ToastProvider";
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

type Invitation = {
  id: string;
  courriel: string;
  nom: string;
  role: Profil["role"];
  cree_le: string;
  utilisateur_id: string | null;
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
  slug,
  invitationsInitiales,
}: {
  parametresInitial: Parametres | null;
  profilsInitial: Profil[];
  monId: string;
  slug: string | null;
  invitationsInitiales: Invitation[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const { afficher } = useToast();
  // L'origine n'est connue que dans le navigateur : la lire au rendu
  // serveur casserait l'hydratation. Même adresse en développement et en
  // production, sans variable de configuration à tenir à jour.
  const [origine, setOrigine] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);

  async function copier(adresse: string) {
    try {
      await navigator.clipboard.writeText(adresse);
      afficher({ titre: "Adresse copiée", severite: "success" });
    } catch {
      afficher({ titre: "Copie impossible", description: "Sélectionnez l'adresse et copiez-la à la main.", severite: "danger" });
    }
  }

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
  const [invitations, setInvitations] = useState(invitationsInitiales);
  const [invite, setInvite] = useState<{ nom: string; courriel: string; role: Profil["role"] }>({
    nom: "",
    courriel: "",
    role: "mecanicien",
  });
  const [envoiInvitation, setEnvoiInvitation] = useState<string | null>(null);
  const [erreurInvitation, setErreurInvitation] = useState<string | null>(null);

  // Envoi et renvoi passent par la même route : la base reconnaît une
  // invitation déjà faite dont le lien n'a jamais servi.
  async function inviter(donnees: { nom: string; courriel: string; role: Profil["role"] }, cle: string) {
    setEnvoiInvitation(cle);
    setErreurInvitation(null);
    let message: string | null = null;
    try {
      const reponse = await fetch("/api/inviter-employe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(donnees),
      });
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) message = corps.error ?? "L'invitation n'a pas pu être envoyée.";
    } catch {
      message = "Le serveur ne répond pas. Vérifiez votre connexion et réessayez.";
    }
    setEnvoiInvitation(null);
    if (message) {
      setErreurInvitation(message);
      return false;
    }
    afficher({ titre: `Invitation envoyée à ${donnees.courriel.trim()}`, severite: "success" });
    const { data } = await supabase
      .from("invitations_employes")
      .select("id, courriel, nom, role, cree_le, utilisateur_id")
      .is("acceptee_le", null)
      .order("cree_le", { ascending: false });
    setInvitations((data as Invitation[]) ?? []);
    router.refresh();
    return true;
  }

  async function soumettreInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (await inviter(invite, "nouvelle")) setInvite({ nom: "", courriel: "", role: "mecanicien" });
  }

  async function annulerInvitation(invitation: Invitation) {
    setErreurInvitation(null);
    const { error } = await supabase.rpc("annuler_invitation", { p_invitation_id: invitation.id });
    if (error) {
      setErreurInvitation(error.message);
      return;
    }
    setInvitations((liste) => liste.filter((i) => i.id !== invitation.id));
    setProfils((liste) => liste.filter((p) => p.id !== invitation.utilisateur_id));
    afficher({ titre: "Invitation annulée", severite: "success" });
  }
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
      <h1 className="text-[1.625rem] font-display font-bold uppercase tracking-[0.01em] mb-1 text-mf-text">Paramètres</h1>
      <p className="text-sm text-mf-text-2 mb-6">Réservé à l'administrateur.</p>

      <form onSubmit={enregistrer} className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-6 flex flex-col gap-3">
        <h2 id="coordonnees" className="scroll-mt-6 font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-1 text-mf-text">
          <Building2 className="w-4 h-4 text-mf-signal-fg" /> Coordonnées du garage
        </h2>
        <Champ label="Nom" required value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
        <Champ
          label="Adresse"
          autoComplete="street-address"
          placeholder="1240 rue Fleury Est, Montréal (Québec) H2C 1R2"
          value={valeurs.adresse ?? ""}
          onChange={(e) => definir("adresse", e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Champ label="Téléphone" type="tel" autoComplete="tel" value={valeurs.telephone ?? ""} onChange={(e) => definir("telephone", e.target.value)} />
          <Champ label="Courriel" type="email" autoComplete="email" value={valeurs.courriel ?? ""} onChange={(e) => definir("courriel", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Champ label="Numéro TPS" placeholder="123456789 RT0001" value={valeurs.tps ?? ""} onChange={(e) => definir("tps", e.target.value)} />
          <Champ label="Numéro TVQ" placeholder="1234567890 TQ0001" value={valeurs.tvq ?? ""} onChange={(e) => definir("tvq", e.target.value)} />
        </div>
        <p className="text-xs text-mf-text-3 -mt-1">
          Imprimés sur chaque facture. Obligatoires dès que vous êtes inscrit aux fichiers de la TPS et de la TVQ ;
          un petit fournisseur non inscrit peut les laisser vides.
        </p>

        <h2 id="atelier" className="scroll-mt-6 font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mt-3 mb-1 text-mf-text">
          <WrenchIcon className="w-4 h-4 text-mf-signal-fg" /> Atelier
        </h2>
        <Champ
          label="Taux horaire de main-d'œuvre ($/h)"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={String(valeurs.taux_horaire)}
          onChange={(e) => definir("taux_horaire", Number(e.target.value) as any)}
          erreur={
            Number(valeurs.taux_horaire) > 0
              ? undefined
              : "À 0 $, chaque heure de main-d'œuvre des nouveaux bons serait facturée gratuitement."
          }
        />
        {/* items-end : « Validité évaluation (jours) » passe sur deux lignes
            et décalait son champ vers le bas par rapport aux deux autres. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
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
          <Star className="w-4 h-4 text-mf-signal-fg" /> Avis Google
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

      {slug && (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-1 text-mf-text">
            <Globe className="w-4 h-4 text-mf-signal-fg" /> Pages publiques de votre garage
          </h2>
          <p className="text-xs text-mf-text-3 mb-4">
            À partager avec vos clients. Ils n'ont besoin d'aucun compte : ce qu'ils envoient arrive dans vos écrans
            « Nouvelles arrivées » et « Demandes de RDV ».
          </p>
          <div className="divide-y divide-mf-border">
            {[
              {
                titre: "Arrivée au comptoir",
                aide: "À afficher en code QR au comptoir : le client remplit sa fiche sur son téléphone en attendant.",
                chemin: `/accueil/${slug}`,
              },
              {
                titre: "Demande de rendez-vous",
                aide: "À mettre sur votre site, votre page Facebook ou votre fiche Google. Vous confirmez chaque demande.",
                chemin: `/accueil/${slug}/rendez-vous`,
              },
            ].map(({ titre, aide, chemin }) => {
              const adresse = `${origine}${chemin}`;
              return (
                <div key={chemin} className="py-3 first:pt-0 last:pb-0">
                  <div className="text-sm font-semibold text-mf-text">{titre}</div>
                  <div className="text-xs text-mf-text-3 mt-0.5">{aide}</div>
                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2">
                    <code className="flex-1 min-w-0 truncate select-all bg-mf-surface-3 border border-mf-border px-3 py-2 text-xs text-mf-text">
                      {adresse}
                    </code>
                    <div className="flex gap-2 shrink-0">
                      <Bouton variante="secondaire" onClick={() => copier(adresse)} className="flex-1 sm:flex-none">
                        <Copy className="w-4 h-4" /> Copier
                      </Bouton>
                      <a
                        href={chemin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[44px] px-4 border border-mf-border-strong text-sm font-semibold text-mf-text hover:bg-mf-surface-2"
                      >
                        <ExternalLink className="w-4 h-4" /> Ouvrir
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-1 text-mf-text">
          <UserCog className="w-4 h-4 text-mf-signal-fg" /> Utilisateurs et rôles
        </h2>
        <p className="text-xs text-mf-text-3 mb-4">
          Chaque employé reçoit un lien par courriel pour choisir son mot de passe. Le rôle décide de ce qu&apos;il
          peut faire : la réception gère clients, rendez-vous et factures ; le mécanicien travaille sur les bons.
        </p>

        <form
          onSubmit={soumettreInvitation}
          id="inviter"
          className="scroll-mt-6 border border-mf-border bg-mf-surface-3 p-4 mb-5 flex flex-col gap-3"
        >
          <div className="text-sm font-semibold text-mf-text">Inviter un employé</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Champ
              label="Nom"
              required
              marquerRequis={false}
              autoComplete="off"
              value={invite.nom}
              onChange={(e) => setInvite((v) => ({ ...v, nom: e.target.value }))}
            />
            <Champ
              label="Courriel"
              type="email"
              required
              marquerRequis={false}
              autoComplete="off"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              value={invite.courriel}
              onChange={(e) => setInvite((v) => ({ ...v, courriel: e.target.value }))}
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="sm:w-56">
              <Selecteur
                label="Rôle"
                value={invite.role}
                onChange={(e) => setInvite((v) => ({ ...v, role: e.target.value as Profil["role"] }))}
              >
                <option value="mecanicien">Mécanicien</option>
                <option value="reception">Réception</option>
                <option value="admin">Administrateur</option>
              </Selecteur>
            </div>
            <Bouton type="submit" enEnvoi={envoiInvitation === "nouvelle"} className="sm:w-fit">
              <Send className="w-4 h-4" /> Envoyer l&apos;invitation
            </Bouton>
          </div>
          {erreurInvitation && <MessageErreur>{erreurInvitation}</MessageErreur>}
        </form>

        {invitations.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-mf-text-3 mb-1">
              En attente d&apos;activation
            </div>
            <div className="divide-y divide-mf-border border-y border-mf-border">
              {invitations.map((i) => (
                <div key={i.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1 flex items-start gap-2">
                    <Mail className="w-4 h-4 mt-0.5 shrink-0 text-mf-text-3" aria-hidden />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-mf-text truncate">
                        {i.nom} <span className="text-mf-text-3 font-normal">· {LABEL_ROLE[i.role]}</span>
                      </div>
                      <div className="text-xs text-mf-text-3 truncate">
                        {i.courriel} · invitée le {formatDateHeure(i.cree_le)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 -ml-2 sm:ml-0 sm:-mr-2">
                    <button
                      type="button"
                      onClick={() => inviter({ nom: i.nom, courriel: i.courriel, role: i.role }, i.id)}
                      disabled={envoiInvitation !== null}
                      className="text-xs font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px] px-2 disabled:opacity-50"
                    >
                      {envoiInvitation === i.id ? "Envoi…" : "Renvoyer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => annulerInvitation(i)}
                      className="text-xs font-semibold text-mf-text-3 hover:text-mf-red min-h-[44px] px-2"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {erreurRoles && <MessageErreur className="mb-3">{erreurRoles}</MessageErreur>}
        <div className="divide-y divide-mf-border">
          {profils
            .filter((p) => !invitations.some((i) => i.utilisateur_id === p.id))
            .map((p) => (
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
              {/* flex-wrap : sur téléphone, le bouton « Désactiver » sortait de la
                  carte, la rangée refusant de passer à la ligne. */}
              <div className="flex items-center flex-wrap gap-2">
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
