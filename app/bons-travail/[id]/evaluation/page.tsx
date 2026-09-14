import { formatQuantite } from "@/lib/nombres";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/dates";
import BoutonImprimer from "@/components/BoutonImprimer";
import BoutonEnvoyerEvaluation from "@/components/BoutonEnvoyerEvaluation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { montantTaxe, formatTaux } from "@/lib/taxes";
import { formatTelephone } from "@/lib/texte";

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
  // Taxes estimées, au cent près comme creer_facture() — voir lib/taxes.ts.
  const tauxTps: number | null = garage?.taux_tps ?? null;
  const tauxTvq: number | null = garage?.taux_tvq ?? null;
  const tpsEstimee = tauxTps != null ? montantTaxe(Number(totalHt), tauxTps) : 0;
  const tvqEstimee = tauxTvq != null ? montantTaxe(Number(totalHt), tauxTvq) : 0;
  const totalEstime = Math.round((Number(totalHt) + tpsEstimee + tvqEstimee) * 100) / 100;
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
            <div className="text-lg font-bold uppercase tracking-wide text-stone-900 mb-2">
              {garage?.nom ?? "Votre garage"}
            </div>
            {garage?.adresse && <div className="text-sm text-stone-600">{garage.adresse}</div>}
            {garage?.telephone && <div className="text-sm text-stone-600">{formatTelephone(garage.telephone)}</div>}
            {garage?.courriel && <div className="text-sm text-stone-600">{garage.courriel}</div>}
            {/* Un numéro par ligne. Sur une seule ligne séparée par « · », la
                paire se coupait au hasard de la largeur. */}
            {(garage?.tps || garage?.tvq) && (
              <div className="text-xs text-stone-500 mt-1 leading-relaxed">
                {garage?.tps && <div>TPS : {garage.tps}</div>}
                {garage?.tvq && <div>TVQ : {garage.tvq}</div>}
              </div>
            )}
          </div>
          {/* shrink-0 : l'identité du garage prenait toute la place et la date
              se coupait avant l'année. */}
          <div className="text-right shrink-0 pl-6">
            <div className="text-xl font-bold uppercase tracking-wide text-stone-900">Évaluation écrite</div>
            <div className="font-mono text-sm text-stone-500">{bon.numero}</div>
            <div className="text-sm text-stone-500 whitespace-nowrap">Date : {formatDateLong(bon.ouvert_le)}</div>
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
              {client?.telephone && <div>{formatTelephone(client.telephone)}</div>}
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
                <td className="py-1.5 text-right">{formatQuantite(l.quantite)}</td>
                <td className="py-1.5 text-right">{formatMoney(l.prix_unitaire)}</td>
                <td className="py-1.5 text-right">{formatMoney(l.quantite * l.prix_unitaire)}</td>
              </tr>
            ))}
            {mainOeuvreLignes.map((l) => (
              <tr key={l.id} className="border-b border-stone-100">
                <td className="py-1.5">{l.description}</td>
                <td className="py-1.5 text-stone-500">Main-d'œuvre</td>
                <td className="py-1.5 text-right">{formatQuantite(l.quantite)} h</td>
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

        {/* Le prix avant taxes reste le montant engageant : c'est lui que fige
            accepter_evaluation(). Mais le client comparera ce document à sa
            facture, qui ajoute TPS et TVQ — sans ces lignes, une évaluation à
            277,45 $ suivie d'une facture à 319,00 $ laissait croire à un
            dépassement. Les taxes sont dites estimées : creer_facture()
            applique le taux en vigueur le jour de la facturation, et une
            facture émise sans taxe ne peut qu'être inférieure.

            La colonne passe de 224 px à 320 px : « Prix total (avant taxes) »
            et la mention de projet s'y repliaient chacune sur deux lignes, sur
            le chiffre le plus important du document. */}
        <div className="flex justify-end">
          <div className="w-full max-w-xs text-sm">
            <div className="flex justify-between gap-4 text-base font-bold border-t border-stone-300 pt-2 mt-1">
              <span className="whitespace-nowrap">Prix total (avant taxes)</span>
              <span className="font-mono tabular-nums">{formatMoney(totalHt)}</span>
            </div>
            {tauxTps != null && tauxTvq != null && (
              <>
                <div className="flex justify-between gap-4 text-stone-500 mt-1.5">
                  <span>TPS estimée ({formatTaux(tauxTps)})</span>
                  <span className="font-mono tabular-nums">{formatMoney(tpsEstimee)}</span>
                </div>
                <div className="flex justify-between gap-4 text-stone-500">
                  <span>TVQ estimée ({formatTaux(tauxTvq)})</span>
                  <span className="font-mono tabular-nums">{formatMoney(tvqEstimee)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t border-stone-200 pt-1.5 mt-1.5 text-stone-700">
                  <span>Total estimé avec taxes</span>
                  <span className="font-mono tabular-nums">{formatMoney(totalEstime)}</span>
                </div>
              </>
            )}
            {!evaluationAcceptee && (
              <div className="text-right text-xs text-amber-700 mt-2">Projet, non accepté par le client</div>
            )}
          </div>
        </div>

        {/* Un emplacement pour signer. Imprimée au comptoir, l'évaluation est le
            document que le client accepte, et la version papier n'offrait
            aucune place pour le faire. Absent dès que l'acceptation est
            enregistrée — elle figure alors dans l'historique plus haut — ou
            qu'une renonciation écrite a été obtenue. */}
        {!evaluationAcceptee && !bon.renonciation_ecrite && (
          <div className="mt-10 grid grid-cols-2 gap-10 text-xs text-stone-500 break-inside-avoid">
            <div>
              <div className="border-b border-stone-400 h-10" />
              <div className="mt-1.5">Signature du client — acceptation de l'évaluation</div>
            </div>
            <div>
              <div className="border-b border-stone-400 h-10" />
              <div className="mt-1.5">Date</div>
            </div>
          </div>
        )}

        <p className="text-xs text-stone-500 mt-8 border-t border-stone-100 pt-4">
          Une fois acceptée, cette évaluation lie {garage?.nom ?? "le garage"} au prix indiqué — aucun
          dépassement sans nouvelle évaluation acceptée par le client.
        </p>
      </div>
    </div>
  );
}
