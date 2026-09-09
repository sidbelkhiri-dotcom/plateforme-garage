import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { todayLocal, formatTimeShort } from "@/lib/dates";
import Badge from "@/components/ui/Badge";
import { Calendar, Wrench, ClipboardList, AlertTriangle, Clock, Receipt } from "lucide-react";

export const dynamic = "force-dynamic";

function formatMoney(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n);
}

// Tableau de bord (9.1) — Server Component en lecture (§6), tout en
// Promise.all pour ne pas enchaîner les allers-retours réseau.
export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profil } = user
    ? await supabase.from("profiles").select("nom, role").eq("id", user.id).single()
    : { data: null };

  const today = todayLocal();

  const [{ data: rdv }, { data: enAtelier }, { data: enAttenteBruts }, { data: stockBas }, { data: facturesImpayees }] =
    await Promise.all([
      supabase
        .from("rendez_vous")
        .select("id, heure, description, statut, client_id")
        .eq("date", today)
        .neq("statut", "annule")
        .order("heure"),
      supabase
        .from("bons_travail")
        .select("id, numero, statut, client_id, vehicule_id")
        .in("statut", ["autorise", "en_cours", "attente_piece"]),
      // bons_travail_totaux n'expose pas client_id (juste les totaux) — on
      // récupère les bons ici, les montants séparément juste après.
      supabase.from("bons_travail").select("id, numero, statut, client_id").eq("statut", "evaluation"),
      supabase.from("inventaire").select("id, nom, quantite, seuil").eq("stock_bas", true),
      supabase
        .from("factures")
        .select("id, numero, client_id, total_ttc, montant_paye, statut")
        .in("statut", ["impayee", "partielle"])
        .order("date"),
    ]);

  const { data: totauxEnAttente } = enAttenteBruts?.length
    ? await supabase
        .from("bons_travail_totaux")
        .select("id, total_ht")
        .in(
          "id",
          enAttenteBruts.map((b) => b.id)
        )
    : { data: [] };
  const totalHt = (id: string) => totauxEnAttente?.find((t) => t.id === id)?.total_ht ?? 0;
  const enAttente = enAttenteBruts ?? [];

  const idsClients = new Set(
    [...(rdv ?? []), ...(enAtelier ?? []), ...enAttente, ...(facturesImpayees ?? [])]
      .map((x: any) => x.client_id)
      .filter(Boolean)
  );
  const { data: clients } = idsClients.size
    ? await supabase.from("clients").select("id, nom").in("id", Array.from(idsClients))
    : { data: [] };
  const nomClient = (id: string | null) => (clients ?? []).find((c) => c.id === id)?.nom ?? "—";

  // Trois états, et un seul sens par couleur — auparavant le calendrier
  // était encre pleine et la clé ambre sans qu'aucune règle ne le
  // justifie, si bien que l'œil cherchait une logique inexistante.
  //   gris   : information, rien à faire
  //   ambre  : quelque chose attend une décision de ta part
  //   rouge  : quelque chose ne va pas
  const TONS = {
    neutre: "bg-mf-surface-3 text-mf-text-2",
    attente: "bg-mf-signal-soft text-mf-signal-fg",
    probleme: "bg-mf-red-soft text-mf-red",
  } as const;

  // L'icône ne passe à côté du texte qu'en xl : c'est la première largeur
  // où cinq colonnes laissent assez de place. Plus tôt, le libellé se
  // retrouvait rogné à quelques pixels au lieu de simplement passer à la
  // ligne.
  const stat = (label: string, value: number, Icon: any, ton: keyof typeof TONS, etendue = "") => (
    <div className={`bg-mf-surface p-4 flex flex-col items-start gap-2 xl:flex-row xl:items-center xl:gap-4 ${etendue}`}>
      <div className={`w-10 h-10 flex items-center justify-center shrink-0 ${TONS[ton]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-none text-mf-text">{value}</div>
        <div className="text-xs text-mf-text-3 uppercase tracking-wide mt-1">{label}</div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-display font-bold uppercase tracking-wide mb-1 text-mf-text">Tableau de bord</h1>
      <p className="text-sm text-mf-text-2 mb-6">
        Bonjour {profil?.nom ?? user?.email} — voici l'atelier aujourd'hui.
      </p>

      {/* Un seul objet, divisé par des filets d'un pixel, plutôt que cinq
          cartes au contour identique à celles du contenu en dessous : le
          bandeau se lit comme le résumé de la journée, et la hiérarchie
          entre résumé et détail redevient visible. Le fond du conteneur
          fait office de filet, ce qui reste correct quand la grille passe
          à la ligne. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-px bg-mf-border border border-mf-border mb-6">
        {stat("RDV aujourd'hui", rdv?.length ?? 0, Calendar, "neutre")}
        {stat("À l'atelier", enAtelier?.length ?? 0, Wrench, "neutre")}
        {stat("En attente d'évaluation", enAttente?.length ?? 0, ClipboardList, (enAttente?.length ?? 0) > 0 ? "attente" : "neutre")}
        {stat("Factures impayées", facturesImpayees?.length ?? 0, Receipt, (facturesImpayees?.length ?? 0) > 0 ? "probleme" : "neutre")}
        {/* Cinq tuiles ne se divisent ni par deux ni par trois : la
            dernière occupe la place restante pour qu'aucune cellule vide
            ne laisse voir le fond du conteneur. */}
        {stat("Stock bas", stockBas?.length ?? 0, AlertTriangle, (stockBas?.length ?? 0) > 0 ? "probleme" : "neutre", "col-span-2 xl:col-span-1")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <Calendar className="w-4 h-4 text-mf-signal-fg" /> Rendez-vous du jour
          </h2>
          {!rdv || rdv.length === 0 ? (
            <p className="text-sm text-mf-text-2">Aucun rendez-vous aujourd'hui.</p>
          ) : (
            <ul className="divide-y divide-mf-border">
              {rdv.map((r) => (
                <li key={r.id} className="py-2 text-sm flex items-center justify-between gap-2 text-mf-text">
                  <span className="font-mono text-mf-text-2 flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-mf-text-3" /> {formatTimeShort(r.heure)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-right">
                    {nomClient(r.client_id)} · {r.description}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/rendez-vous" className="text-xs font-semibold text-mf-blue-hover hover:text-mf-blue mt-3 inline-block">
            Voir le calendrier →
          </Link>
        </div>

        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <Wrench className="w-4 h-4 text-mf-signal-fg" /> Véhicules à l'atelier
          </h2>
          {!enAtelier || enAtelier.length === 0 ? (
            <p className="text-sm text-mf-text-2">Rien en cours actuellement.</p>
          ) : (
            <ul className="divide-y divide-mf-border">
              {enAtelier.map((b) => (
                <li key={b.id}>
                  <Link href={`/bons-travail/${b.id}`} className="py-2 flex items-center justify-between gap-2 text-mf-text hover:text-mf-blue-hover">
                    <span className="font-mono text-sm">{b.numero}</span>
                    <span className="text-sm flex-1 min-w-0 truncate text-right">{nomClient(b.client_id)}</span>
                    <Badge tone={b.statut === "attente_piece" ? "rouge" : "ambre"}>
                      {b.statut === "en_cours" ? "En cours" : b.statut === "attente_piece" ? "Attente pièce" : "Autorisé"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <ClipboardList className="w-4 h-4 text-mf-signal-fg" /> Bons en attente d'autorisation
          </h2>
          {!enAttente || enAttente.length === 0 ? (
            <p className="text-sm text-mf-text-2">Aucun bon en attente.</p>
          ) : (
            <ul className="divide-y divide-mf-border">
              {enAttente.map((b) => (
                <li key={b.id}>
                  <Link href={`/bons-travail/${b.id}`} className="py-2 flex items-center justify-between gap-2 text-mf-text hover:text-mf-blue-hover">
                    <span className="font-mono text-sm">{b.numero}</span>
                    <span className="text-sm flex-1 min-w-0 truncate text-right">{nomClient(b.client_id)}</span>
                    <span className={`font-mono text-sm ${totalHt(b.id) > 100 ? "text-mf-blue-hover font-semibold" : ""}`}>
                      {formatMoney(totalHt(b.id))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <Receipt className="w-4 h-4 text-mf-signal-fg" /> Factures impayées
          </h2>
          {!facturesImpayees || facturesImpayees.length === 0 ? (
            <p className="text-sm text-mf-text-2">Aucune facture impayée.</p>
          ) : (
            <ul className="divide-y divide-mf-border">
              {facturesImpayees.map((f) => (
                <li key={f.id}>
                  <Link href={`/factures/${f.id}`} className="py-2 flex items-center justify-between gap-2 text-mf-text hover:text-mf-blue-hover">
                    <span className="font-mono text-sm">{f.numero}</span>
                    <span className="text-sm flex-1 min-w-0 truncate text-right">{nomClient(f.client_id)}</span>
                    <span className="font-mono text-sm text-mf-red font-semibold">
                      {formatMoney(f.total_ttc - f.montant_paye)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/factures" className="text-xs font-semibold text-mf-blue-hover hover:text-mf-blue mt-3 inline-block">
            Voir toutes les factures →
          </Link>
        </div>

        <div className="bg-mf-surface rounded-mf-md border border-mf-border p-4">
          <h2 className="font-display font-bold text-sm uppercase tracking-wide flex items-center gap-2 mb-3 text-mf-text">
            <AlertTriangle className="w-4 h-4 text-mf-signal-fg" /> Alertes de stock
          </h2>
          {!stockBas || stockBas.length === 0 ? (
            <p className="text-sm text-mf-text-2">Inventaire au niveau.</p>
          ) : (
            <ul className="divide-y divide-mf-border">
              {stockBas.map((i) => (
                <li key={i.id} className="py-2 text-sm flex justify-between text-mf-text">
                  <span>{i.nom}</span>
                  <span className="font-mono text-mf-red">
                    {i.quantite} / seuil {i.seuil}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/inventaire" className="text-xs font-semibold text-mf-blue-hover hover:text-mf-blue mt-3 inline-block">
            Voir l'inventaire →
          </Link>
        </div>
      </div>
    </div>
  );
}
