import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong } from "@/lib/dates";
import BoutonImprimer from "@/components/BoutonImprimer";
import BoutonEnvoyerCourriel from "@/components/BoutonEnvoyerCourriel";

const LABEL_ETAT: Record<string, string> = {
  neuve: "Neuve",
  usagee: "Usagée",
  reusinee: "Réusinée",
  remise_a_neuf: "Remise à neuf",
};

const LABEL_STATUT: Record<string, string> = {
  impayee: "Impayée",
  partielle: "Partiellement payée",
  payee: "Payée",
  annulee: "Annulée",
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

function finGarantieDate(dateStr: string, mois: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + mois, d, 12));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

// Document conforme PRD §4.2 : identités et adresses des deux parties,
// véhicule, date de livraison et kilométrage, réparations avec état de
// chaque pièce, heures/taux/coût de main-d'œuvre, taxes, total, garantie.
// Server Component en lecture (§6) — les montants sont figés en base par
// creer_facture(), jamais recalculés ici.
export default async function FacturePage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: facture } = await supabase.from("factures").select("*").eq("id", params.id).single();
  if (!facture) notFound();

  const [{ data: client }, { data: vehicule }, { data: lignes }, { data: garage }] = await Promise.all([
    facture.client_id ? supabase.from("clients").select("*").eq("id", facture.client_id).single() : Promise.resolve({ data: null }),
    facture.vehicule_id
      ? supabase.from("vehicules").select("*").eq("id", facture.vehicule_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("facture_lignes").select("*").eq("facture_id", params.id).order("ordre"),
    supabase.from("parametres").select("*").single(),
  ]);

  const piecesLignes = (lignes ?? []).filter((l) => l.type === "piece");
  const mainOeuvreLignes = (lignes ?? []).filter((l) => l.type === "main_oeuvre");
  const solde = facture.total_ttc - facture.montant_paye;
  const dateLimiteGarantie = finGarantieDate(facture.date, facture.garantie_mois);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="sans-impression flex items-center justify-between mb-6">
        <Link
          href={facture.bon_travail_id ? `/bons-travail/${facture.bon_travail_id}` : "/factures"}
          className="flex items-center gap-1 text-sm text-mf-text-2 hover:text-mf-text min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="flex items-center gap-2">
          <BoutonEnvoyerCourriel
            factureId={facture.id}
            clientEmail={client?.email ?? null}
            envoyeeLe={facture.envoyee_le}
            sansTaxe={facture.sans_taxe}
          />
          <BoutonImprimer />
        </div>
      </div>

      {facture.libelle && (
        <p className="sans-impression text-xs text-mf-text-3 -mt-4 mb-2 text-right">
          Libellé : <span className="text-mf-text font-semibold">{facture.libelle}</span>
        </p>
      )}
      {facture.envoyee_le && (
        <p className="sans-impression text-xs text-mf-text-3 -mt-2 mb-4 text-right">
          Envoyée à {facture.envoyee_a} le {formatDateLong(facture.envoyee_le.slice(0, 10))}
        </p>
      )}

      {/* Document légal : toujours papier blanc / texte noir, indépendant
          du thème de l'appli (même rendu à l'écran qu'à l'impression) —
          donc chaque texte précise sa couleur au lieu d'hériter du body. */}
      <div className="bg-white border border-stone-200 rounded-lg p-8 print:border-none print:p-0 text-stone-900">
        {facture.statut === "annulee" && (
          <div className="mb-6 bg-red-50 border border-red-300 text-red-800 rounded px-4 py-3 text-sm">
            <div className="font-black uppercase tracking-wide">
              {facture.sans_taxe ? "Reçu annulé" : "Facture annulée"}
            </div>
            {facture.annulee_le && <div>Le {formatDateLong(facture.annulee_le.slice(0, 10))}</div>}
            {facture.motif_annulation && <div>Motif : {facture.motif_annulation}</div>}
          </div>
        )}
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
            <div className="text-xl font-black uppercase tracking-wide text-stone-900">
              {facture.sans_taxe ? "Reçu de paiement" : "Facture"}
            </div>
            <div className="font-mono text-sm text-stone-500">{facture.numero}</div>
            <div className="text-sm text-stone-500">Date de livraison : {formatDateLong(facture.date)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">Client</div>
            <div className="text-sm">
              <div className="font-semibold">{client?.nom ?? "—"}</div>
              {(client?.adresse || client?.code_postal) && (
                <div>{[client?.adresse, client?.code_postal].filter(Boolean).join(", ")}</div>
              )}
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
              {facture.kilometrage != null && <div>Kilométrage : {facture.kilometrage.toLocaleString("fr-CA")} km</div>}
            </div>
          </div>
        </div>

        <table className="w-full text-sm mb-2">
          <thead>
            <tr className="border-b border-stone-300 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <th className="py-2">Description</th>
              <th className="py-2">État / type</th>
              <th className="py-2 text-right">Qté / heures</th>
              <th className="py-2 text-right">Prix / taux</th>
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
          </tbody>
        </table>

        <div className="flex justify-end mb-6">
          <div className="w-64">
            <Row label="Pièces" value={formatMoney(facture.total_pieces)} />
            <Row label="Main-d'œuvre" value={formatMoney(facture.total_main_oeuvre)} />
            <div className="border-t border-stone-200 mt-1 pt-1">
              <Row label="Total avant taxes" value={formatMoney(facture.total_ht)} />
            </div>
            {facture.sans_taxe ? (
              <Row label="Sans taxe" value={formatMoney(0)} muted />
            ) : (
              <>
                <Row label={`TPS (${(facture.taux_tps * 100).toFixed(3)} %)`} value={formatMoney(facture.montant_tps)} />
                <Row label={`TVQ (${(facture.taux_tvq * 100).toFixed(3)} %)`} value={formatMoney(facture.montant_tvq)} />
              </>
            )}
            <div className="border-t border-stone-300 mt-1 pt-1">
              <Row label="Total" value={formatMoney(facture.total_ttc)} bold />
            </div>
            {facture.montant_paye > 0 && (
              <>
                <Row label="Payé" value={formatMoney(facture.montant_paye)} muted />
                <Row label="Solde" value={formatMoney(solde)} bold />
              </>
            )}
          </div>
        </div>

        <div className="sans-impression mb-6">
          <span
            className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${
              facture.statut === "payee"
                ? "bg-emerald-100 text-emerald-700"
                : facture.statut === "partielle"
                  ? "bg-amber-100 text-amber-700"
                  : facture.statut === "annulee"
                    ? "bg-stone-200 text-stone-700"
                    : "bg-red-100 text-red-700"
            }`}
          >
            {LABEL_STATUT[facture.statut] ?? facture.statut}
          </span>
        </div>

        <div className="border-t border-stone-100 pt-4">
          <div className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">Garantie</div>
          <p className="text-sm text-stone-700">
            Pièces et main-d'œuvre garanties {facture.garantie_mois} mois ou {facture.garantie_km.toLocaleString("fr-CA")} km,
            selon la première échéance atteinte — jusqu'au {formatDateLong(dateLimiteGarantie)} ou{" "}
            {(facture.kilometrage != null
              ? facture.kilometrage + facture.garantie_km
              : facture.garantie_km
            ).toLocaleString("fr-CA")}{" "}
            km.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold = false, muted = false }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-stone-500">{label}</span>
      <span className={`font-mono ${bold ? "font-bold text-base" : muted ? "text-stone-500" : ""}`}>{value}</span>
    </div>
  );
}
