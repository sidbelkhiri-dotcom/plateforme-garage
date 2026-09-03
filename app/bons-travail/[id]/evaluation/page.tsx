import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/dates";
import BoutonImprimer from "@/components/BoutonImprimer";
import BoutonEnvoyerEvaluation from "@/components/BoutonEnvoyerEvaluation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const LABEL_ETAT: Record<string, string> = {
  neuve: "Neuve",
  usagee: "Usagée",
  reusinee: "Réusinée",
  remise_a_neuf: "Remise à neuf",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

// Document conforme PRD §4.1 : identités et adresses des deux parties,
// caractéristiques du véhicule, description des travaux, état de chaque
// pièce, prix total, date et durée de validité. Server Component en
// lecture (§6) — rien ici ne modifie les données.
export default async function EvaluationEcritePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: bon } = await supabase.from("bons_travail").select("*").eq("id", params.id).single();
  if (!bon) notFound();

  const [{ data: client }, { data: vehicule }, { data: lignes }, { data: totaux }, { data: garage }, { data: evaluations }] =
    await Promise.all([
      bon.client_id ? supabase.from("clients").select("*").eq("id", bon.client_id).single() : Promise.resolve({ data: null }),
      bon.vehicule_id
        ? supabase.from("vehicules").select("*").eq("id", bon.vehicule_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("bon_travail_lignes").select("*").eq("bon_travail_id", params.id).order("ordre"),
      supabase.from("bons_travail_totaux").select("*").eq("id", params.id).single(),
      supabase.from("parametres").select("*").single(),
      supabase
        .from("bon_travail_evaluations")
        .select("id, montant, type, accepte_le, accepte_par:profiles(nom)")
        .eq("bon_travail_id", params.id)
        .order("accepte_le"),
    ]);

  const piecesLignes = (lignes ?? []).filter((l) => l.type === "piece");
  const mainOeuvreLignes = (lignes ?? []).filter((l) => l.type === "main_oeuvre");
  // bon.montant_evaluation est le montant figé accepté par le client (D13) —
  // c'est LE montant juridiquement engageant. totaux.total_ht est recalculé
  // à chaque affichage et bouge dès qu'une ligne change ; l'utiliser ici
  // ferait perdre la preuve du plafond accepté sur une réimpression après
  // ajout de travaux. On ne retombe sur le total courant que tant qu'aucune
  // évaluation n'a encore été acceptée.
  const evaluationAcceptee = bon.montant_evaluation != null;
  const totalHt = evaluationAcceptee ? bon.montant_evaluation : totaux?.total_ht ?? 0;
  // Supabase infère accepte_par:profiles(nom) comme un tableau dans ce
  // contexte de jointure — à l'exécution c'est bien un objet unique
  // (relation plusieurs-à-un), seule l'inférence de type est trop prudente.
  const evaluationsTypees = (evaluations ?? []) as unknown as Array<{
    id: string;
    montant: number;
    type: string;
    accepte_le: string;
    accepte_par: { nom: string } | null;
  }>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="sans-impression flex items-center justify-between mb-6">
        <Link
          href={`/bons-travail/${bon.id}`}
          className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Retour au bon {bon.numero}
        </Link>
        <div className="flex items-center gap-2">
          <BoutonEnvoyerEvaluation
            bonTravailId={bon.id}
            clientEmail={client?.email ?? null}
            envoyeeLe={bon.evaluation_envoyee_le}
          />
          <BoutonImprimer />
        </div>
      </div>

      {bon.evaluation_envoyee_le && (
        <p className="sans-impression text-xs text-mf-text-3 -mt-4 mb-4 text-right">
          Envoyé à {bon.evaluation_envoyee_a} le {formatDateLong(bon.evaluation_envoyee_le.slice(0, 10))}
        </p>
      )}

      {/* Document légal : toujours papier blanc / texte noir, indépendant
          du thème de l'appli (même rendu à l'écran qu'à l'impression) —
          donc chaque texte précise sa couleur au lieu d'hériter du body. */}
      <div className="bg-white border border-stone-200 rounded-lg p-8 print:border-none print:p-0 text-stone-900">
        <div className="flex items-start justify-between border-b border-stone-200 pb-4 mb-6">
          <div>
            <div className="text-lg font-black uppercase tracking-wide text-stone-900 mb-2">
              {garage?.nom ?? "Votre garage"}
            </div>
            {garage?.adresse && <div className="text-sm text-stone-600">{garage.adresse}</div>}
            {garage?.telephone && <div className="text-sm text-stone-600">{garage.telephone}</div>}
            {garage?.courriel && <div className="text-sm text-stone-600">{garage.courriel}</div>}
            {(garage?.tps || garage?.tvq) && (
              <div className="text-xs text-stone-500 mt-1">
                {garage?.tps && <>TPS : {garage.tps} </>}
                {garage?.tvq && <>· TVQ : {garage.tvq}</>}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xl font-black uppercase tracking-wide text-stone-900">Évaluation écrite</div>
            <div className="font-mono text-sm text-stone-500">{bon.numero}</div>
            <div className="text-sm text-stone-500">Date : {formatDateLong(bon.ouvert_le)}</div>
          </div>
        </div>

        {bon.renonciation_ecrite ? (
          <div className="bg-amber-50 border border-amber-300 rounded px-4 py-3 mb-6 text-sm text-amber-900">
            <b>Renonciation écrite obtenue.</b> Le client a renoncé par écrit à recevoir une évaluation
            détaillée avant travaux — document manuscrit signé conservé au dossier, distinct de cette page.
            {bon.evaluation_acceptee_le && (
              <> Renonciation enregistrée le {formatDateLong(bon.evaluation_acceptee_le.slice(0, 10))}.</>
            )}
          </div>
        ) : (
          <div className="mb-6 text-sm">
            <span className="text-stone-500">Durée de validité : </span>
            {bon.evaluation_valide_jusqu_au ? (
              <span className="font-semibold">
                valide jusqu'au {formatDateLong(bon.evaluation_valide_jusqu_au)}
              </span>
            ) : (
              <span className="font-semibold">
                {garage?.validite_evaluation_jours ?? 30} jours à compter de l'acceptation
              </span>
            )}
          </div>
        )}

        {evaluationsTypees.length > 1 && (
          <div className="bg-stone-50 border border-stone-200 rounded px-4 py-3 mb-6 text-sm text-stone-700">
            <b className="text-stone-900">Évaluation réévaluée en cours de travaux.</b> Le montant ci-dessous est le
            dernier accepté par le client.
            <table className="w-full mt-2 text-xs">
              <tbody>
                {evaluationsTypees.map((ev) => (
                  <tr key={ev.id}>
                    <td className="py-0.5 text-stone-500">
                      {ev.type === "initiale" ? "Évaluation initiale" : "Réévaluation complémentaire"} —{" "}
                      {formatDateLong(ev.accepte_le.slice(0, 10))}
                      {ev.accepte_par?.nom ? ` (${ev.accepte_par.nom})` : ""}
                    </td>
                    <td className="py-0.5 text-right font-mono text-stone-900">{formatMoney(ev.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">Client</div>
            <div className="text-sm">
              <div className="font-semibold">{client?.nom ?? "—"}</div>
              {client?.adresse && <div>{client.adresse}</div>}
              {client?.telephone && <div>{client.telephone}</div>}
              {client?.email && <div>{client.email}</div>}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">Véhicule</div>
            <div className="text-sm">
              <div className="font-semibold">
                {vehicule ? `${vehicule.marque} ${vehicule.modele ?? ""} ${vehicule.annee ? `(${vehicule.annee})` : ""}` : "—"}
              </div>
              {vehicule?.plaque && <div>Immatriculation : {vehicule.plaque}</div>}
              {vehicule?.vin && <div>NIV : {vehicule.vin}</div>}
              <div>Kilométrage : {bon.kilometrage.toLocaleString("fr-CA")} km</div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">Description de la réparation</div>
          <div className="text-sm">
            <div>
              <span className="text-stone-500">Plainte du client : </span>
              {bon.plainte_client}
            </div>
            {bon.diagnostic && (
              <div className="mt-1">
                <span className="text-stone-500">Diagnostic : </span>
                {bon.diagnostic}
              </div>
            )}
          </div>
        </div>

        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="border-b border-stone-300 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="py-2">Description</th>
              <th className="py-2">État</th>
              <th className="py-2 text-right">Qté</th>
              <th className="py-2 text-right">Prix unit.</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {piecesLignes.map((l) => (
              <tr key={l.id} className="border-b border-stone-100">
                <td className="py-1.5">{l.description}</td>
                <td className="py-1.5">{LABEL_ETAT[l.etat_piece ?? ""] ?? "—"}</td>
                <td className="py-1.5 text-right">{l.quantite}</td>
                <td className="py-1.5 text-right">{formatMoney(l.prix_unitaire)}</td>
                <td className="py-1.5 text-right">{formatMoney(l.quantite * l.prix_unitaire)}</td>
              </tr>
            ))}
            {mainOeuvreLignes.map((l) => (
              <tr key={l.id} className="border-b border-stone-100">
                <td className="py-1.5">{l.description}</td>
                <td className="py-1.5 text-stone-500">Main-d'œuvre</td>
                <td className="py-1.5 text-right">{l.quantite} h</td>
                <td className="py-1.5 text-right">{formatMoney(l.prix_unitaire)}</td>
                <td className="py-1.5 text-right">{formatMoney(l.quantite * l.prix_unitaire)}</td>
              </tr>
            ))}
            {(lignes ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-stone-500">
                  Aucune ligne pour l'instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56">
            <div className="flex justify-between text-base font-bold border-t border-stone-300 pt-2 mt-1">
              <span>
                Prix total (avant taxes)
                {!evaluationAcceptee && (
                  <span className="block text-[11px] font-normal text-amber-700 normal-case tracking-normal">
                    Projet, non accepté par le client
                  </span>
                )}
              </span>
              <span className="font-mono">{formatMoney(totalHt)}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-stone-500 mt-8 border-t border-stone-100 pt-4">
          Une fois acceptée, cette évaluation lie {garage?.nom ?? "le garage"} au prix indiqué — aucun
          dépassement sans nouvelle évaluation acceptée par le client.
        </p>
      </div>
    </div>
  );
}
