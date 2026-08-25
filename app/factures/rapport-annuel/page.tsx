import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayLocal, formatDateLong } from "@/lib/dates";
import BoutonImprimer from "@/components/BoutonImprimer";

const LABEL_STATUT: Record<string, string> = {
  impayee: "Impayée",
  partielle: "Partielle",
  payee: "Payée",
  annulee: "Annulée",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

// Document destiné au comptable en fin d'année — même traitement papier
// blanc / texte noir que les autres documents légaux (facture,
// évaluation écrite), imprimable/exportable en PDF via BoutonImprimer
// (window.print(), pas de bibliothèque PDF séparée — même principe que
// 6.2 dans PLAN.md). Server Component en lecture, rien ici ne modifie
// les données.
// PostgREST plafonne une réponse à 1000 lignes par défaut, sans erreur —
// au-delà, .select() tronque silencieusement (audit du 18 août, point
// 14). Un garage avec plus de 1000 factures dans l'année verrait un CA
// inférieur à la réalité sur le document remis au comptable. Même
// pagination que scripts/sauvegarde.mjs.
async function chargerToutesLesFactures(
  supabase: ReturnType<typeof createClient>,
  annee: string
) {
  const TAILLE_PAGE = 1000;
  const lignes: Array<{
    id: string;
    numero: string;
    date: string;
    client_id: string | null;
    total_ht: number;
    montant_tps: number;
    montant_tvq: number;
    total_ttc: number;
    statut: string;
    montant_paye: number;
    libelle: string | null;
  }> = [];
  let page = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("factures")
      .select("id, numero, date, client_id, total_ht, montant_tps, montant_tvq, total_ttc, statut, montant_paye, libelle")
      .gte("date", `${annee}-01-01`)
      .lte("date", `${annee}-12-31`)
      .order("date")
      .range(page * TAILLE_PAGE, page * TAILLE_PAGE + TAILLE_PAGE - 1);
    if (error) throw error;
    lignes.push(...(data ?? []));
    if (!data || data.length < TAILLE_PAGE) break;
    page += 1;
  }
  return lignes;
}

export default async function RapportAnnuelPage({ searchParams }: { searchParams: { annee?: string } }) {
  const supabase = createClient();
  const annee = searchParams.annee || todayLocal().slice(0, 4);

  const [factures, { data: clients }, { data: garage }] = await Promise.all([
    chargerToutesLesFactures(supabase, annee),
    supabase.from("clients").select("id, nom"),
    supabase.from("parametres").select("*").eq("id", 1).single(),
  ]);

  const nomsClients = Object.fromEntries((clients ?? []).map((c) => [c.id, c.nom]));
  const toutes = factures ?? [];
  // Les factures annulées restent listées pour la trace, mais ne comptent
  // pas dans les totaux — même logique que D32 (annuler_facture) : une
  // facture annulée ne représente plus un revenu réel.
  const actives = toutes.filter((f) => f.statut !== "annulee");

  const totaux = actives.reduce(
    (acc, f) => ({
      ht: acc.ht + f.total_ht,
      tps: acc.tps + f.montant_tps,
      tvq: acc.tvq + f.montant_tvq,
      ttc: acc.ttc + f.total_ttc,
      paye: acc.paye + f.montant_paye,
    }),
    { ht: 0, tps: 0, tvq: 0, ttc: 0, paye: 0 }
  );

  const anneeCourante = Number(todayLocal().slice(0, 4));
  const anneesDisponibles = Array.from({ length: 6 }, (_, i) => String(anneeCourante - i));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="sans-impression flex items-center justify-between mb-6 flex-wrap gap-3">
        <Link href="/factures" className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text min-h-[44px]">
          <ArrowLeft className="w-4 h-4" /> Retour aux factures
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {anneesDisponibles.map((a) => (
              <Link
                key={a}
                href={`/factures/rapport-annuel?annee=${a}`}
                className={`px-3 min-h-[36px] flex items-center rounded-mf-pill text-xs font-semibold border transition-colors ${
                  a === annee
                    ? "bg-mf-blue text-white border-mf-blue"
                    : "bg-mf-surface text-mf-text-2 border-mf-border hover:bg-mf-surface-2"
                }`}
              >
                {a}
              </Link>
            ))}
          </div>
          <BoutonImprimer />
        </div>
      </div>

      {/* Document destiné à l'extérieur (comptable) : toujours papier
          blanc / texte noir, indépendant du thème de l'appli. */}
      <div className="bg-white border border-stone-200 rounded-lg p-8 print:border-none print:p-0 text-stone-900">
        <div className="flex items-start justify-between border-b border-stone-200 pb-4 mb-6">
          <div>
            <img src="/logo-fond-clair.png" alt={garage?.nom ?? "MECAFORCE"} className="h-9 w-auto mb-4" />
            {garage?.adresse && <div className="text-sm text-stone-600">{garage.adresse}</div>}
            {garage?.telephone && <div className="text-sm text-stone-600">{garage.telephone}</div>}
            {(garage?.tps || garage?.tvq) && (
              <div className="text-xs text-stone-500 mt-1">
                {garage?.tps && <>TPS : {garage.tps} </>}
                {garage?.tvq && <>· TVQ : {garage.tvq}</>}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xl font-black uppercase tracking-wide text-stone-900">Rapport annuel</div>
            <div className="text-sm text-stone-500">Année {annee}</div>
            <div className="text-xs text-stone-400">Imprimé le {formatDateLong(todayLocal())}</div>
          </div>
        </div>

        {toutes.length === 0 ? (
          <p className="text-sm text-stone-500 py-8 text-center">Aucune facture pour l'année {annee}.</p>
        ) : (
          <>
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-stone-300 text-left text-[11px] uppercase tracking-wide text-stone-500">
                  <th className="py-2">Numéro</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Client</th>
                  <th className="py-2 text-right">Total HT</th>
                  <th className="py-2 text-right">TPS</th>
                  <th className="py-2 text-right">TVQ</th>
                  <th className="py-2 text-right">Total TTC</th>
                  <th className="py-2">Libellé</th>
                  <th className="py-2 text-right">Statut</th>
                </tr>
              </thead>
              <tbody>
                {toutes.map((f) => (
                  <tr key={f.id} className={`border-b border-stone-100 ${f.statut === "annulee" ? "text-stone-400" : ""}`}>
                    <td className="py-1.5 font-mono">{f.numero}</td>
                    <td className="py-1.5">{formatDateLong(f.date)}</td>
                    <td className="py-1.5">{f.client_id ? nomsClients[f.client_id] ?? "—" : "—"}</td>
                    <td className="py-1.5 text-right">{formatMoney(f.total_ht)}</td>
                    <td className="py-1.5 text-right">{formatMoney(f.montant_tps)}</td>
                    <td className="py-1.5 text-right">{formatMoney(f.montant_tvq)}</td>
                    <td className="py-1.5 text-right">{formatMoney(f.total_ttc)}</td>
                    <td className="py-1.5 text-stone-600">{f.libelle ?? ""}</td>
                    <td className="py-1.5 text-right">{LABEL_STATUT[f.statut] ?? f.statut}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-72 text-sm">
                <div className="flex justify-between py-0.5">
                  <span className="text-stone-500">Total HT</span>
                  <span className="font-mono">{formatMoney(totaux.ht)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-stone-500">TPS</span>
                  <span className="font-mono">{formatMoney(totaux.tps)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-stone-500">TVQ</span>
                  <span className="font-mono">{formatMoney(totaux.tvq)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t border-stone-300 pt-2 mt-1">
                  <span>Total TTC</span>
                  <span className="font-mono">{formatMoney(totaux.ttc)}</span>
                </div>
                <div className="flex justify-between py-0.5 mt-1">
                  <span className="text-stone-500">Payé</span>
                  <span className="font-mono">{formatMoney(totaux.paye)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-stone-500">Solde impayé</span>
                  <span className="font-mono">{formatMoney(totaux.ttc - totaux.paye)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-stone-400 mt-6 border-t border-stone-100 pt-4">
              {toutes.length} facture(s) émise(s) en {annee}
              {toutes.length !== actives.length && <> · {toutes.length - actives.length} annulée(s), exclue(s) des totaux</>}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
