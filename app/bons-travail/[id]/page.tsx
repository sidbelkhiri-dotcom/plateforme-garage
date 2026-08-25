"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  User,
  Car,
  CheckCircle2,
  PlayCircle,
  Wrench,
  FileSignature,
  Gauge,
  Receipt,
  PackageX,
  RefreshCw,
  History,
  Camera,
} from "lucide-react";
import Modale from "@/components/ui/Modale";
import Bouton from "@/components/ui/Bouton";
import Badge, { type ToneBadge } from "@/components/ui/Badge";
import Chargement from "@/components/ui/Chargement";
import MessageErreur from "@/components/ui/MessageErreur";
import Champ from "@/components/ui/Champ";
import FormulaireLigneBon, { ETATS_PIECE, type EtatPiece, type TypeLigne } from "@/components/forms/FormulaireLigneBon";
import { useProfil } from "@/lib/useProfil";
import { useToast } from "@/components/ui/ToastProvider";
import { todayLocal, formatDateLong } from "@/lib/dates";

type Statut = "evaluation" | "autorise" | "en_cours" | "attente_piece" | "termine" | "facture" | "annule";

type Bon = {
  id: string;
  numero: string;
  client_id: string | null;
  vehicule_id: string | null;
  employe_id: string | null;
  kilometrage: number;
  plainte_client: string;
  diagnostic: string | null;
  notes_internes: string | null;
  statut: Statut;
  taux_horaire: number;
  montant_evaluation: number | null;
  evaluation_valide_jusqu_au: string | null;
  renonciation_ecrite: boolean;
  pieces_a_remettre: boolean;
  ouvert_le: string;
  ferme_le: string | null;
};

type Ligne = {
  id: string;
  type: TypeLigne;
  description: string;
  quantite: number;
  prix_unitaire: number;
  etat_piece: EtatPiece | null;
  piece_id: string | null;
  code_barre: string | null;
  installee_le: string | null;
  fournisseur: string | null;
  photos_facture: string[];
};

type Evaluation = {
  id: string;
  montant: number;
  type: "initiale" | "complementaire";
  accepte_le: string;
  accepte_par: { nom: string } | null;
};

const LABEL_STATUT: Record<Statut, string> = {
  evaluation: "Évaluation",
  autorise: "Autorisé",
  en_cours: "En cours",
  attente_piece: "Attente pièce",
  termine: "Terminé",
  facture: "Facturé",
  annule: "Annulé",
};

const TON_STATUT: Record<Statut, ToneBadge> = {
  evaluation: "ardoise",
  autorise: "ambre",
  en_cours: "ambre",
  attente_piece: "rouge",
  termine: "emeraude",
  facture: "emeraude",
  annule: "rouge",
};

const LABEL_ETAT: Record<EtatPiece, string> = {
  neuve: "Neuve",
  usagee: "Usagée",
  reusinee: "Réusinée",
  remise_a_neuf: "Remise à neuf",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

export default function BonTravailDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const { profil, peutAutoriser } = useProfil();
  const { afficher } = useToast();

  const [bon, setBon] = useState<Bon | null>(null);
  const [client, setClient] = useState<{ id: string; nom: string } | null>(null);
  const [vehicule, setVehicule] = useState<{ id: string; marque: string; modele: string | null } | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [factureId, setFactureId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [showLigne, setShowLigne] = useState<{ type: TypeLigne; ligne?: Ligne } | null>(null);
  const [showRenonciation, setShowRenonciation] = useState(false);
  const [showCreerFacture, setShowCreerFacture] = useState(false);
  const [libelleFacture, setLibelleFacture] = useState("");
  const [compteFidelite, setCompteFidelite] = useState(false);
  const [fideliteOfferte, setFideliteOfferte] = useState(false);
  const [carte, setCarte] = useState<{ progression: number } | null>(null);
  const [showReevaluation, setShowReevaluation] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    const { data: b } = await supabase.from("bons_travail").select("*").eq("id", id).single();
    setBon(b);
    if (b) {
      const [{ data: c }, { data: v }, { data: l }, { data: ev }] = await Promise.all([
        b.client_id ? supabase.from("clients").select("id, nom").eq("id", b.client_id).single() : Promise.resolve({ data: null }),
        b.vehicule_id
          ? supabase.from("vehicules").select("id, marque, modele").eq("id", b.vehicule_id).single()
          : Promise.resolve({ data: null }),
        supabase.from("bon_travail_lignes").select("*").eq("bon_travail_id", id).order("ordre"),
        supabase
          .from("bon_travail_evaluations")
          .select("id, montant, type, accepte_le, accepte_par:profiles(nom)")
          .eq("bon_travail_id", id)
          .order("accepte_le"),
      ]);
      setClient(c);
      setVehicule(v);
      setLignes(l ?? []);
      setEvaluations((ev ?? []) as unknown as Evaluation[]);
      if (b.statut === "facture") {
        const { data: f } = await supabase
          .from("factures")
          .select("id")
          .eq("bon_travail_id", id)
          .maybeSingle();
        setFactureId(f?.id ?? null);
      }
    }
    setChargement(false);
  }, [id, supabase]);

  useEffect(() => {
    charger();
  }, [charger]);

  if (chargement) return <div className="p-6"><Chargement /></div>;
  if (!bon) return <div className="p-6 text-sm text-mf-text-2">Bon de travail introuvable.</div>;

  const peutTravailler = peutAutoriser || (profil?.role === "mecanicien" && profil.id === bon.employe_id);
  const peutModifierLignes = peutTravailler && ["evaluation", "autorise", "en_cours", "attente_piece"].includes(bon.statut);

  const totalPieces = lignes.filter((l) => l.type === "piece").reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const totalMainOeuvre = lignes
    .filter((l) => l.type === "main_oeuvre")
    .reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const totalHt = totalPieces + totalMainOeuvre;
  // "termine" doit rester dans la liste : c'est l'état juste avant de
  // cliquer "Créer la facture", le moment précis où ce bandeau importe le
  // plus. L'ancienne version l'excluait, ce qui éteignait l'alerte
  // exactement quand on facture un dépassement non réévalué (audit du 18
  // août, point 2). Le bandeau s'éteint légitimement une fois "facture" —
  // la facture existe déjà et reflète le vrai total — ou "annule".
  const depasseEvaluation =
    bon.montant_evaluation != null &&
    totalHt > bon.montant_evaluation &&
    ["autorise", "en_cours", "attente_piece", "termine"].includes(bon.statut);
  // PRD §4.1 : au-delà de 100 $, une évaluation écrite acceptée ou une
  // renonciation est obligatoire avant d'autoriser les travaux (6.5).
  const evaluationRequise =
    bon.statut === "evaluation" && totalHt > 100 && bon.montant_evaluation == null && !bon.renonciation_ecrite;

  async function majBon(patch: Partial<Bon>) {
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.from("bons_travail").update(patch).eq("id", id);
    setBusy(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    charger();
  }

  // Envoi automatique du devis au client dès qu'un prix est confirmé —
  // sert de preuve de l'accord. Best-effort : ne bloque jamais le flux
  // d'acceptation (ex. client sans courriel enregistré), juste un toast.
  async function envoyerDevisAutomatiquement() {
    try {
      const reponse = await fetch("/api/envoyer-evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonTravailId: id }),
      });
      const donnees = await reponse.json();
      if (reponse.ok) {
        afficher({ titre: "Devis envoyé au client", description: `Envoyé à ${donnees.envoyeeA}`, severite: "success" });
      } else {
        afficher({ titre: "Devis non envoyé", description: donnees.error, severite: "warning" });
      }
    } catch {
      afficher({ titre: "Devis non envoyé", description: "Erreur réseau.", severite: "warning" });
    }
  }

  async function accepterEvaluation() {
    setBusy(true);
    setErreur(null);
    // p_montant_attendu : la fonction refuse si le total a changé côté
    // base depuis l'affichage (une ligne ajoutée pendant l'appel au
    // client, par exemple) plutôt que de figer silencieusement un
    // montant que personne n'a vu (audit du 18 août, point 10).
    const { error } = await supabase.rpc("accepter_evaluation", { bon_id: id, p_montant_attendu: totalHt });
    setBusy(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    envoyerDevisAutomatiquement();
    charger();
  }

  async function confirmerRenonciation() {
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.rpc("renoncer_evaluation", { bon_id: id });
    setBusy(false);
    setShowRenonciation(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    charger();
  }

  async function confirmerReevaluation() {
    setBusy(true);
    setErreur(null);
    const { error } = await supabase.rpc("reevaluer_bon", { bon_id: id, p_montant_attendu: totalHt });
    setBusy(false);
    setShowReevaluation(false);
    if (error) {
      setErreur(error.message);
      return;
    }
    envoyerDevisAutomatiquement();
    charger();
  }

  async function supprimerLigne(ligneId: string) {
    await supabase.from("bon_travail_lignes").delete().eq("id", ligneId);
    charger();
  }

  // Pré-détection : si le bon contient de l'huile, la case « compte pour
  // la carte » est cochée d'avance. Ce n'est qu'une suggestion — le
  // personnel garde le dernier mot, parce qu'un appoint d'huile sur une
  // réparation de freins ne doit pas compter comme une visite d'entretien.
  async function ouvrirCreerFacture() {
    const contientHuile = lignes.some(
      (l) => l.type === "piece" && /huile|vidange/i.test(l.description)
    );
    setCompteFidelite(contientHuile);
    setFideliteOfferte(false);

    if (bon?.client_id) {
      const { data } = await supabase
        .from("cartes_fidelite")
        .select("progression")
        .eq("client_id", bon.client_id)
        .maybeSingle();
      setCarte(data ?? null);
    }
    setShowCreerFacture(true);
  }

  async function creerFacture() {
    setBusy(true);
    setErreur(null);
    const { data: nouvelId, error } = await supabase.rpc("creer_facture", {
      bon_id: id,
      p_date: todayLocal(),
    });
    if (error) {
      setBusy(false);
      setErreur(error.message);
      return;
    }
    const complements: Record<string, unknown> = {};
    if (libelleFacture.trim()) complements.libelle = libelleFacture.trim();
    if (compteFidelite) complements.compte_fidelite = true;
    if (fideliteOfferte) complements.fidelite_offerte = true;
    if (Object.keys(complements).length > 0) {
      await supabase.from("factures").update(complements).eq("id", nouvelId);
    }
    setBusy(false);
    router.push(`/factures/${nouvelId}`);
  }

  return (
    <div className="p-6 max-w-3xl">
      <button
        onClick={() => router.push("/bons-travail")}
        className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text mb-4 min-h-[44px]"
      >
        <ArrowLeft className="w-4 h-4" /> Retour aux bons de travail
      </button>

      {depasseEvaluation && (
        <div className="mb-4 flex items-start gap-2 bg-mf-red-soft border border-mf-red text-mf-red rounded-mf-sm px-4 py-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm flex-1">
            <div className="font-bold">Le total dépasse l'évaluation acceptée.</div>
            <div>
              Évaluation : {formatMoney(bon.montant_evaluation ?? 0)} · Travaux actuels : {formatMoney(totalHt)}.
              Rappelez le client pour une évaluation complémentaire avant de continuer.
            </div>
            {peutAutoriser && ["autorise", "en_cours", "attente_piece"].includes(bon.statut) && (
              <button
                onClick={() => setShowReevaluation(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2 hover:no-underline min-h-[44px]"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Enregistrer la réévaluation complémentaire ({formatMoney(totalHt)})
              </button>
            )}
          </div>
        </div>
      )}

      {evaluationRequise && (
        <div className="mb-4 flex items-start gap-2 bg-mf-warning-soft border border-mf-warning text-mf-warning rounded-mf-sm px-4 py-3">
          <FileSignature className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-bold">Une évaluation écrite est obligatoire au-delà de 100 $.</div>
            <div>
              Total actuel : {formatMoney(totalHt)}. Faites accepter l'évaluation (ou obtenez une renonciation
              écrite) avant d'autoriser les travaux — c'est une exigence légale, pas une formalité.
            </div>
          </div>
        </div>
      )}

      {erreur && <MessageErreur className="mb-4">{erreur}</MessageErreur>}

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-xl font-black font-mono tracking-wide text-mf-text">{bon.numero}</h1>
          <div className="flex items-center gap-3">
            <Link
              href={`/bons-travail/${bon.id}/evaluation`}
              className="flex items-center gap-1.5 text-xs font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px]"
            >
              <FileSignature className="w-3.5 h-3.5" /> Évaluation imprimable
            </Link>
            <Badge tone={TON_STATUT[bon.statut]}>{LABEL_STATUT[bon.statut]}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-mf-text-2">
          {client && (
            <Link href={`/clients/${client.id}`} className="flex items-center gap-1.5 hover:text-mf-blue-hover">
              <User className="w-3.5 h-3.5" /> {client.nom}
            </Link>
          )}
          {vehicule && (
            <Link href={`/vehicules/${vehicule.id}`} className="flex items-center gap-1.5 hover:text-mf-blue-hover">
              <Car className="w-3.5 h-3.5" /> {vehicule.marque} {vehicule.modele}
            </Link>
          )}
          <span className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-mf-text-3" /> {bon.kilometrage.toLocaleString("fr-CA")} km
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-mf-border text-sm">
          <div className="text-[11px] uppercase tracking-wide text-mf-text-3">Plainte du client</div>
          <div className="text-mf-text">{bon.plainte_client}</div>
        </div>
      </div>

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide mb-2 text-mf-text">Diagnostic</h2>
        <textarea
          defaultValue={bon.diagnostic ?? ""}
          disabled={!peutModifierLignes}
          onBlur={(e) => e.target.value !== (bon.diagnostic ?? "") && majBon({ diagnostic: e.target.value })}
          rows={3}
          placeholder="Ce que le mécanicien a trouvé..."
          className="w-full bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text disabled:bg-mf-surface disabled:text-mf-text-3 focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft"
        />
      </div>

      <LignesSection
        titre="Pièces"
        lignes={lignes.filter((l) => l.type === "piece")}
        peutModifier={peutModifierLignes}
        onAjouter={() => setShowLigne({ type: "piece" })}
        onModifier={(l) => setShowLigne({ type: "piece", ligne: l })}
        onSupprimer={supprimerLigne}
        renduLigne={(l) => (l.etat_piece ? LABEL_ETAT[l.etat_piece] : "")}
      />

      <LignesSection
        titre="Main-d'œuvre"
        lignes={lignes.filter((l) => l.type === "main_oeuvre")}
        peutModifier={peutModifierLignes}
        onAjouter={() => setShowLigne({ type: "main_oeuvre" })}
        onModifier={(l) => setShowLigne({ type: "main_oeuvre", ligne: l })}
        onSupprimer={supprimerLigne}
        renduLigne={(l) => `${l.quantite} h`}
      />

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4 ml-auto w-full sm:w-64">
        <Row label="Pièces" value={formatMoney(totalPieces)} />
        <Row label="Main-d'œuvre" value={formatMoney(totalMainOeuvre)} />
        <div className="border-t border-mf-border mt-2 pt-2">
          <Row label="Total HT" value={formatMoney(totalHt)} bold />
        </div>
        {bon.montant_evaluation != null && (
          <div className="border-t border-mf-border mt-2 pt-2">
            <Row label="Évaluation acceptée" value={formatMoney(bon.montant_evaluation)} muted />
          </div>
        )}
      </div>

      {evaluations.length > 0 && (
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4">
          <h2 className="flex items-center gap-1.5 font-display font-bold text-sm uppercase tracking-wide mb-2 text-mf-text">
            <History className="w-4 h-4" /> Historique d'évaluation
          </h2>
          <div className="divide-y divide-mf-border">
            {evaluations.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="text-mf-text">
                    {ev.type === "initiale" ? "Évaluation initiale" : "Réévaluation complémentaire"}
                  </span>
                  <span className="text-mf-text-3">
                    {" "}
                    · {formatDateLong(ev.accepte_le.slice(0, 10))}
                    {ev.accepte_par?.nom ? ` · ${ev.accepte_par.nom}` : ""}
                  </span>
                </div>
                <span className="font-mono text-mf-text">{formatMoney(ev.montant)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-mf-surface rounded-mf-md border border-mf-border p-5 mb-4 flex flex-col gap-3">
        <label className="flex items-center gap-3 text-sm min-h-[44px] text-mf-text">
          <input
            type="checkbox"
            checked={bon.pieces_a_remettre}
            disabled={!peutModifierLignes}
            onChange={(e) => majBon({ pieces_a_remettre: e.target.checked })}
            className="w-5 h-5"
          />
          Pièces remplacées à remettre au client
        </label>
        <div>
          <h2 className="font-display font-bold text-sm uppercase tracking-wide mb-1 text-mf-text">Notes internes</h2>
          <p className="text-xs text-mf-text-3 mb-2">Non imprimées, jamais montrées au client.</p>
          <textarea
            defaultValue={bon.notes_internes ?? ""}
            disabled={!peutTravailler}
            onBlur={(e) => e.target.value !== (bon.notes_internes ?? "") && majBon({ notes_internes: e.target.value })}
            rows={2}
            className="w-full bg-mf-surface-3 border border-mf-border-strong rounded-mf-sm px-3 py-2 text-sm text-mf-text disabled:bg-mf-surface focus:outline-none focus:border-mf-blue focus:ring-2 focus:ring-mf-blue-soft"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {bon.statut === "evaluation" && peutAutoriser && (
          <>
            <Bouton onClick={accepterEvaluation} enEnvoi={busy}>
              <CheckCircle2 className="w-4 h-4" /> Accepter l'évaluation ({formatMoney(totalHt)})
            </Bouton>
            <Bouton variante="secondaire" onClick={() => setShowRenonciation(true)}>
              <FileSignature className="w-4 h-4" /> Renonciation écrite obtenue
            </Bouton>
          </>
        )}
        {bon.statut === "evaluation" && !peutAutoriser && (
          <p className="text-sm text-mf-text-2">
            En attente d'acceptation par la réception ou l'administrateur.
          </p>
        )}
        {bon.statut === "autorise" && peutTravailler && (
          <Bouton onClick={() => majBon({ statut: "en_cours" })} enEnvoi={busy}>
            <PlayCircle className="w-4 h-4" /> Démarrer la réparation
          </Bouton>
        )}
        {bon.statut === "en_cours" && peutTravailler && (
          <>
            <Bouton onClick={() => majBon({ statut: "termine", ferme_le: todayLocal() })} enEnvoi={busy}>
              <Wrench className="w-4 h-4" /> Marquer terminé
            </Bouton>
            <Bouton variante="secondaire" onClick={() => majBon({ statut: "attente_piece" })} enEnvoi={busy}>
              <PackageX className="w-4 h-4" /> Mettre en attente de pièce
            </Bouton>
          </>
        )}
        {bon.statut === "attente_piece" && peutTravailler && (
          <Bouton onClick={() => majBon({ statut: "en_cours" })} enEnvoi={busy}>
            <PlayCircle className="w-4 h-4" /> Reprendre les travaux
          </Bouton>
        )}
        {bon.statut === "termine" && peutAutoriser && (
          <Bouton onClick={ouvrirCreerFacture} enEnvoi={busy}>
            <Receipt className="w-4 h-4" /> Créer la facture
          </Bouton>
        )}
        {bon.statut === "termine" && !peutAutoriser && (
          <p className="text-sm text-mf-text-2">Bon terminé le {bon.ferme_le}. En attente de facturation.</p>
        )}
        {bon.statut === "facture" && factureId && (
          <Link
            href={`/factures/${factureId}`}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold bg-mf-blue hover:bg-mf-blue-hover text-white transition-colors"
          >
            <Receipt className="w-4 h-4" /> Voir la facture
          </Link>
        )}
      </div>

      {showLigne && (
        <Modale
          titre={showLigne.ligne ? "Modifier la ligne" : showLigne.type === "piece" ? "Ajouter une pièce" : "Ajouter de la main-d'œuvre"}
          surFermeture={() => setShowLigne(null)}
        >
          <FormulaireLigneBon
            bonTravailId={bon.id}
            type={showLigne.type}
            ligneId={showLigne.ligne?.id}
            pieceIdInitial={showLigne.ligne?.piece_id}
            photosFactureInitiales={showLigne.ligne?.photos_facture}
            valeursInitiales={
              showLigne.ligne
                ? {
                    description: showLigne.ligne.description,
                    quantite: String(showLigne.ligne.quantite),
                    prix_unitaire: String(showLigne.ligne.prix_unitaire),
                    etat_piece: showLigne.ligne.etat_piece ?? "neuve",
                    code_barre: showLigne.ligne.code_barre ?? "",
                    installee_le: showLigne.ligne.installee_le ?? todayLocal(),
                    fournisseur: showLigne.ligne.fournisseur ?? "",
                  }
                : { prix_unitaire: showLigne.type === "main_oeuvre" ? String(bon.taux_horaire) : "0" }
            }
            onSucces={() => {
              setShowLigne(null);
              charger();
            }}
            onAnnuler={() => setShowLigne(null)}
          />
        </Modale>
      )}

      {showRenonciation && (
        <Modale titre="Confirmer la renonciation écrite" surFermeture={() => setShowRenonciation(false)}>
          <div className="flex gap-3 mb-4">
            <FileSignature className="w-5 h-5 text-mf-blue-hover shrink-0 mt-0.5" />
            <p className="text-sm text-mf-text-2">
              Pour être valide, le client doit avoir <b className="text-mf-text">rédigé lui-même</b> le document de renonciation et l'avoir{" "}
              <b className="text-mf-text">signé</b> — une case cochée ici ne remplace pas ce document. Confirmez seulement si ce document
              papier a été obtenu et archivé.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Bouton variante="secondaire" onClick={() => setShowRenonciation(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={confirmerRenonciation} enEnvoi={busy}>
              Confirmer et autoriser le bon
            </Bouton>
          </div>
        </Modale>
      )}

      {showReevaluation && (
        <Modale titre="Confirmer la réévaluation complémentaire" surFermeture={() => setShowReevaluation(false)}>
          <div className="flex gap-3 mb-4">
            <RefreshCw className="w-5 h-5 text-mf-blue-hover shrink-0 mt-0.5" />
            <p className="text-sm text-mf-text-2">
              Le client doit avoir été <b className="text-mf-text">recontacté et avoir accepté</b> le nouveau total avant
              de confirmer. Le montant évalué passera de {formatMoney(bon.montant_evaluation ?? 0)} à{" "}
              <b className="text-mf-text">{formatMoney(totalHt)}</b> — l'ancien montant reste conservé dans
              l'historique ci-dessous, rien n'est effacé.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Bouton variante="secondaire" onClick={() => setShowReevaluation(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={confirmerReevaluation} enEnvoi={busy}>
              Confirmer la réévaluation
            </Bouton>
          </div>
        </Modale>
      )}

      {showCreerFacture && (
        <Modale titre="Créer la facture" surFermeture={() => setShowCreerFacture(false)}>
          <Champ
            label="Libellé (optionnel)"
            placeholder="Ex. Comptant, Garantie..."
            value={libelleFacture}
            onChange={(e) => setLibelleFacture(e.target.value)}
          />
          <p className="text-xs text-mf-text-3 mt-1 mb-3">
            Juste pour identifier cette facture toi-même — n'affecte ni le calcul ni les taxes.
          </p>
          <div className="bg-mf-surface-3 rounded-mf-sm p-3 text-sm">
            <div className="flex justify-between text-mf-text-2">
              <span>Total HT</span>
              <span className="font-mono text-mf-text">{formatMoney(totalHt)}</span>
            </div>
            <p className="text-xs text-mf-text-3 mt-2">TPS et TVQ calculées aux taux courants (Paramètres).</p>
          </div>

          <div className="mt-4 border border-mf-border rounded-mf-sm p-3 flex flex-col gap-2.5">
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-mf-text-3">
              Carte de fidélité
            </div>

            {carte && carte.progression >= 5 && (
              <p className="text-sm text-mf-success bg-mf-success-soft border border-mf-success rounded-mf-sm px-3 py-2">
                Ce client a {carte.progression} changements d&rsquo;huile payés — le prochain lui est offert.
              </p>
            )}

            <label className="flex items-center gap-3 text-sm text-mf-text min-h-[36px]">
              <input
                type="checkbox"
                checked={compteFidelite}
                onChange={(e) => {
                  setCompteFidelite(e.target.checked);
                  if (e.target.checked) setFideliteOfferte(false);
                }}
                className="w-5 h-5"
              />
              Changement d&rsquo;huile payé — compte pour la carte
            </label>

            <label className="flex items-center gap-3 text-sm text-mf-text min-h-[36px]">
              <input
                type="checkbox"
                checked={fideliteOfferte}
                onChange={(e) => {
                  setFideliteOfferte(e.target.checked);
                  if (e.target.checked) setCompteFidelite(false);
                }}
                className="w-5 h-5"
              />
              C&rsquo;est le changement d&rsquo;huile offert — remet le compteur à zéro
            </label>

            {carte && (
              <p className="text-xs text-mf-text-3">
                Progression actuelle&nbsp;: {Math.max(0, carte.progression)} sur 5 avant la gratuité.
              </p>
            )}
          </div>

          {erreur && <MessageErreur className="mt-3">{erreur}</MessageErreur>}
          <div className="flex justify-end gap-2 mt-4">
            <Bouton variante="secondaire" onClick={() => setShowCreerFacture(false)}>
              Annuler
            </Bouton>
            <Bouton onClick={creerFacture} enEnvoi={busy}>
              Créer la facture
            </Bouton>
          </div>
        </Modale>
      )}
    </div>
  );
}

function LignesSection({
  titre,
  lignes,
  peutModifier,
  onAjouter,
  onModifier,
  onSupprimer,
  renduLigne,
}: {
  titre: string;
  lignes: Ligne[];
  peutModifier: boolean;
  onAjouter: () => void;
  onModifier: (l: Ligne) => void;
  onSupprimer: (id: string) => void;
  renduLigne: (l: Ligne) => string;
}) {
  const total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  return (
    <div className="bg-mf-surface rounded-mf-md border border-mf-border mb-4 overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-mf-border">
        <h2 className="font-display font-bold text-sm uppercase tracking-wide text-mf-text">
          {titre} <span className="text-mf-text-3 font-normal">({formatMoney(total)})</span>
        </h2>
        {peutModifier && (
          <button
            onClick={onAjouter}
            className="flex items-center gap-1 text-xs font-semibold text-mf-blue-hover hover:text-mf-blue min-h-[44px] px-2"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        )}
      </div>
      {lignes.length === 0 ? (
        <p className="text-sm text-mf-text-2 px-4 py-4">Aucune ligne.</p>
      ) : (
        <div className="divide-y divide-mf-border">
          {lignes.map((l) => (
            <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate text-mf-text">{l.description}</div>
                <div className="text-xs text-mf-text-3">
                  {renduLigne(l)} · {l.quantite} × {formatMoney(l.prix_unitaire)} = {formatMoney(l.quantite * l.prix_unitaire)}
                </div>
                {l.type === "piece" && (l.code_barre || l.installee_le) && (
                  <div className="text-xs text-mf-text-3 mt-0.5">
                    {l.installee_le && <>Installée le {formatDateLong(l.installee_le)}</>}
                    {l.installee_le && l.code_barre && " · "}
                    {l.code_barre && <>CB : {l.code_barre}</>}
                  </div>
                )}
                {l.type === "piece" && (l.fournisseur || l.photos_facture.length > 0) && (
                  <div className="text-xs text-mf-text-3 mt-0.5 flex items-center gap-1">
                    {l.fournisseur && <>Fournisseur : {l.fournisseur}</>}
                    {l.fournisseur && l.photos_facture.length > 0 && " · "}
                    {l.photos_facture.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-mf-blue-hover">
                        <Camera className="w-3 h-3" /> {l.photos_facture.length} photo{l.photos_facture.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {peutModifier && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onModifier(l)}
                    className="text-mf-text-3 hover:text-mf-text w-11 h-11 flex items-center justify-center"
                    aria-label="Modifier la ligne"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onSupprimer(l.id)}
                    className="text-mf-text-3 hover:text-mf-red w-11 h-11 flex items-center justify-center"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold = false, muted = false }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className={muted ? "text-mf-text-3" : "text-mf-text-2"}>{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-base text-mf-text" : muted ? "text-mf-text-3" : "text-mf-text"}`}>{value}</span>
    </div>
  );
}
