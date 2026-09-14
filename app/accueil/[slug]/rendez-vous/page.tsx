"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFormulaire } from "@/lib/useFormulaire";
import { todayLocal } from "@/lib/dates";
import Champ from "@/components/ui/Champ";
import Selecteur from "@/components/ui/Selecteur";
import Bouton from "@/components/ui/Bouton";
import MessageErreur from "@/components/ui/MessageErreur";
import ChampsVehicule from "@/components/forms/ChampsVehicule";
import { formatTelephone } from "@/lib/texte";
import { AvisCollecte, ConsentementCommunications } from "@/components/ConfidentialitePublique";

type Valeurs = {
  nom: string;
  telephone: string;
  courriel: string;
  marque: string;
  modele: string;
  annee: string;
  service: string;
  dateSouhaitee: string;
  plage: "matin" | "apres_midi" | "flexible";
  message: string;
  consentement: boolean;
  // Piège à robots : champ invisible pour un humain, que les robots de
  // formulaires remplissent. Voir envoyer().
  siteWeb: string;
};

const VALEURS_VIDES: Valeurs = {
  nom: "",
  telephone: "",
  courriel: "",
  marque: "",
  modele: "",
  annee: "",
  service: "",
  dateSouhaitee: "",
  plage: "flexible",
  message: "",
  consentement: false,
  siteWeb: "",
};

// Enregistrés en clair dans demandes_rendez_vous.service, que l'écran du
// personnel affiche tel quel : ce sont donc des libellés, pas des codes.
const SERVICES = [
  "Entretien et changement d'huile",
  "Freins",
  "Pneus",
  "Diagnostic (témoin allumé, bruit…)",
  "Inspection",
  "Autre",
];

// Valeurs imposées par la contrainte de la table (2026-08-23) et traduites
// par LABEL_PLAGE dans app/demandes-rendez-vous/page.tsx.
const PLAGES: { valeur: Valeurs["plage"]; libelle: string }[] = [
  { valeur: "matin", libelle: "Matin" },
  { valeur: "apres_midi", libelle: "Après-midi" },
  { valeur: "flexible", libelle: "Peu importe" },
];

type GaragePublic = { id: string; nom: string; adresse: string | null; telephone: string | null };

// Demande de rendez-vous en ligne, par garage.
//
// Jusqu'au 2026-09-13, rien dans Garagenda ne créait de demande de
// rendez-vous : l'écran « Demandes de RDV » du personnel les lisait, mais
// seules celles d'un garage doté de son propre site web arrivaient. Un
// nouveau garage avait une boîte vide par construction. Cette page lui en
// donne une dès son inscription, sans site web à lui.
//
// Sous /accueil plutôt que /rendez-vous : /rendez-vous est le calendrier
// interne du personnel, et /accueil est déjà ouvert sans session par
// middleware.ts. Même patron que la page d'arrivée au comptoir : le garage
// est résolu par obtenir_garage_public() — jamais une lecture directe de
// `garages`, qui porte des colonnes sensibles — et la demande atterrit dans
// demandes_rendez_vous, en attente de la réception de CE garage.
//
// C'est une DEMANDE, et la page le dit à chaque étape : un client qui croit
// avoir réservé et se présente sans confirmation est pire qu'aucun
// formulaire.
export default function PageDemandeRendezVous({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { valeurs, definir, soumettre, erreur, enEnvoi } = useFormulaire<Valeurs>(VALEURS_VIDES);
  const [garage, setGarage] = useState<GaragePublic | null | undefined>(undefined);
  const [envoye, setEnvoye] = useState(false);
  const [erreurContact, setErreurContact] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .rpc("obtenir_garage_public", { p_slug: params.slug })
      .then(({ data }) => setGarage(data ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!garage) return;

    // Sans téléphone ni courriel, le garage ne peut pas confirmer : la
    // demande serait perdue sans que le client le sache.
    if (!valeurs.telephone.trim() && !valeurs.courriel.trim()) {
      setErreurContact("Indiquez un téléphone ou un courriel pour que le garage puisse vous confirmer le rendez-vous.");
      return;
    }
    setErreurContact(null);

    // Un robot a rempli le champ invisible : on affiche le succès sans rien
    // enregistrer, pour ne pas lui apprendre qu'il a été repéré. Ça n'arrête
    // que les robots naïfs — un envoi direct à l'API contourne la page — mais
    // ça ne coûte rien à un humain.
    if (valeurs.siteWeb) {
      setEnvoye(true);
      return;
    }

    const donnees = {
      garage_id: garage.id,
      nom: valeurs.nom.trim(),
      telephone: valeurs.telephone.trim() || null,
      courriel: valeurs.courriel.trim() || null,
      marque: valeurs.marque || null,
      modele: valeurs.modele || null,
      annee: valeurs.annee ? Number(valeurs.annee) : null,
      service: valeurs.service || null,
      date_souhaitee: valeurs.dateSouhaitee || null,
      plage: valeurs.plage,
      message: valeurs.message.trim() || null,
      consentement_communications: valeurs.consentement,
    };
    const reussi = await soumettre(async () => {
      const { error } = await supabase.from("demandes_rendez_vous").insert(donnees);
      return {
        error: error
          ? {
              message: garage.telephone
                ? `La demande n'a pas pu être envoyée. Appelez directement le garage au ${formatTelephone(garage.telephone)}.`
                : "La demande n'a pas pu être envoyée. Réessayez dans un instant.",
            }
          : null,
      };
    });
    if (reussi) setEnvoye(true);
  }

  if (garage === undefined) {
    return <div className="min-h-screen bg-mf-bg" />;
  }

  if (garage === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mf-bg p-6">
        <div className="max-w-sm text-center">
          <AlertTriangle className="w-8 h-8 text-mf-red mx-auto mb-3" />
          <p className="text-sm text-mf-text">Ce lien n'est plus valide.</p>
        </div>
      </div>
    );
  }

  const coordonnees = (
    <div className="flex flex-col gap-1 text-sm text-mf-text-2">
      {garage.adresse && (
        <span className="inline-flex items-start gap-1.5">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-mf-text-3" /> {garage.adresse}
        </span>
      )}
      {garage.telephone && (
        <a
          href={`tel:${garage.telephone.replace(/[^\d+]/g, "")}`}
          className="inline-flex items-center gap-1.5 font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px] sm:min-h-0"
        >
          <Phone className="w-4 h-4 shrink-0" /> {formatTelephone(garage.telephone)}
        </a>
      )}
    </div>
  );

  if (envoye) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mf-bg p-3 sm:p-6">
        <div className="bg-mf-surface border border-mf-border p-6 sm:p-8 w-full max-w-md">
          <CheckCircle2 className="w-10 h-10 text-mf-success mb-3" />
          <div className="font-display text-[1.625rem] font-bold uppercase leading-tight tracking-[0.01em] text-mf-text">
            Demande envoyée
          </div>
          <p className="text-sm text-mf-text mt-2">
            Merci. <b>{garage.nom}</b> vous contactera pour confirmer la date et l'heure.
          </p>
          <p className="text-sm text-mf-text-2 mt-2">
            Votre rendez-vous n'est pas encore réservé : attendez la confirmation du garage avant de vous présenter.
          </p>
          <div className="mt-4">{coordonnees}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-mf-bg p-3 sm:p-6">
      <form
        onSubmit={envoyer}
        className="relative bg-mf-surface border border-mf-border p-6 sm:p-8 w-full max-w-md flex flex-col gap-3"
      >
        <header className="mb-1">
          <div className="font-display text-[1.625rem] font-bold uppercase leading-tight tracking-[0.01em] text-mf-text">
            {garage.nom}
          </div>
          <p className="text-base font-medium text-mf-text mt-1">Demande de rendez-vous</p>
          <p className="text-sm text-mf-text-2 mt-1.5">
            Dites-nous ce dont votre véhicule a besoin et quand vous seriez disponible. Le garage vous contactera pour
            confirmer.
          </p>
          <div className="mt-2">{coordonnees}</div>
        </header>

        <Champ label="Nom" required autoComplete="name" value={valeurs.nom} onChange={(e) => definir("nom", e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Champ
            label="Téléphone"
            type="tel"
            autoComplete="tel"
            value={valeurs.telephone}
            onChange={(e) => definir("telephone", e.target.value)}
          />
          <Champ
            label="Courriel"
            type="email"
            autoComplete="email"
            value={valeurs.courriel}
            onChange={(e) => definir("courriel", e.target.value)}
          />
        </div>
        {erreurContact && <MessageErreur>{erreurContact}</MessageErreur>}

        <ChampsVehicule
          valeurs={{ marque: valeurs.marque, modele: valeurs.modele, annee: valeurs.annee }}
          definir={(champ, valeur) => definir(champ, valeur)}
        />

        <Selecteur label="Service souhaité" value={valeurs.service} onChange={(e) => definir("service", e.target.value)}>
          <option value="">— Choisir —</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selecteur>

        <Champ
          label="Date souhaitée"
          type="date"
          min={todayLocal()}
          value={valeurs.dateSouhaitee}
          onChange={(e) => definir("dateSouhaitee", e.target.value)}
        />

        {/* Trois boutons plutôt qu'un menu : sur téléphone, un choix se fait
            d'un seul toucher au lieu d'ouvrir une liste. */}
        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em] mb-1">
            Moment de la journée
          </legend>
          <div className="grid grid-cols-3 border border-mf-border-strong">
            {PLAGES.map(({ valeur, libelle }, i) => {
              const actif = valeurs.plage === valeur;
              return (
                <label
                  key={valeur}
                  className={`relative flex items-center justify-center min-h-[44px] px-2 text-sm cursor-pointer select-none transition-colors ${
                    i > 0 ? "border-l border-mf-border-strong" : ""
                  } ${actif ? "bg-mf-blue text-mf-on-blue font-semibold" : "bg-mf-surface-3 text-mf-text hover:bg-mf-surface-2"}`}
                >
                  <input
                    type="radio"
                    name="plage"
                    value={valeur}
                    checked={actif}
                    onChange={() => definir("plage", valeur)}
                    className="sr-only peer"
                  />
                  {libelle}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-mf-text-3 text-[11px] uppercase tracking-[0.08em]">Précisions</span>
          <textarea
            rows={3}
            value={valeurs.message}
            onChange={(e) => definir("message", e.target.value)}
            placeholder="Ex. « bruit à l'avant en freinant depuis une semaine »"
            className="bg-mf-surface-3 border border-mf-border-strong px-3 py-2 text-sm text-mf-text focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft resize-none"
          />
        </label>

        {/* Hors écran plutôt que masqué : beaucoup de robots ignorent les
            champs en display:none, pas ceux qu'on a simplement poussés hors
            de la vue. Retiré de la navigation au clavier et des lecteurs
            d'écran, pour qu'aucun humain ne tombe dessus. */}
        <div className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
          <label>
            Site web
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={valeurs.siteWeb}
              onChange={(e) => definir("siteWeb", e.target.value)}
            />
          </label>
        </div>

        {erreur && <MessageErreur>{erreur}</MessageErreur>}

        <ConsentementCommunications
          nomGarage={garage.nom}
          coche={valeurs.consentement}
          surChangement={(v) => definir("consentement", v)}
        />

        <AvisCollecte nomGarage={garage.nom} slug={params.slug} finalite="traiter votre demande de rendez-vous" />

        <Bouton type="submit" enEnvoi={enEnvoi} className="w-full mt-1">
          Envoyer la demande
        </Bouton>
        <p className="text-center text-[11px] text-mf-text-3 mt-1">Propulsé par Garagenda</p>
      </form>
    </div>
  );
}
