import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  Gauge,
  MapPin,
  MessageSquareText,
  Package,
  QrCode,
  ShieldCheck,
  Star,
  UsersRound,
} from "lucide-react";
import Logo from "@/components/Logo";
import { MaquetteBon, MaquetteDepassement, MaquetteFacture, MaquetteTelephone } from "@/components/vitrine/Maquettes";

export const metadata: Metadata = {
  title: "Garagenda — Logiciel de gestion de garage au Québec",
  description:
    "Bons de travail, évaluations écrites, inspections avec photos approuvées par le client, factures TPS et TVQ. En français, pour les garages du Québec. Essai gratuit de 14 jours.",
  openGraph: {
    title: "Garagenda — tout l'atelier, du premier appel à la facture",
    description:
      "Le logiciel de gestion d'atelier pensé pour les garages du Québec : évaluations conformes, inspections photo, factures TPS et TVQ.",
    locale: "fr_CA",
    type: "website",
  },
};

// Site vitrine de Garagenda : ce que voit un propriétaire de garage qui ne
// nous connaît pas encore (middleware.ts l'affiche à la racine pour un
// visiteur non connecté).
//
// Règle de rédaction : chaque promesse correspond à une fonction qui existe
// et que les suites de tests éprouvent. Pas de témoignage inventé, pas de
// statistique empruntée à un concurrent, pas de « des centaines de garages ».
// Le jour où une affirmation cesse d'être vraie, elle sort de cette page.
//
// Direction : l'univers du bon de travail — étiquettes de champ en petites
// capitales, numéros en chasse fixe, papier et encre — dans la charte de
// l'application (Denim, laiton, angles vifs, aucune ombre). Le laiton ne
// sert qu'à un repère par section.

const ETAPES = [
  { titre: "L'arrivée", texte: "Rendez-vous demandé en ligne, ou fiche remplie par le client sur son téléphone au comptoir." },
  { titre: "L'évaluation", texte: "Écrite, envoyée ou imprimée, acceptée par le client. Le prix est figé." },
  { titre: "L'inspection", texte: "Photos à l'appui, le client approuve ou refuse chaque réparation de son téléphone." },
  { titre: "Les travaux", texte: "Pièces et main-d'œuvre sur le bon, stock déduit à la fin des travaux." },
  { titre: "La facture", texte: "TPS et TVQ calculées, numéro suivant, envoi par courriel, paiement encaissé." },
  { titre: "Le suivi", texte: "Rappel la veille du rendez-vous, demande d'avis, relance des réparations refusées." },
];

const AUSSI = [
  { icone: CalendarClock, titre: "Rendez-vous en ligne", texte: "Une page de réservation à votre nom, à mettre sur Facebook ou votre fiche Google. Vous confirmez chaque demande." },
  { icone: QrCode, titre: "Arrivée au comptoir", texte: "Le client remplit sa fiche sur son téléphone pendant que vous finissez l'appel en cours." },
  { icone: Package, titre: "Inventaire", texte: "Les pièces utilisées sortent du stock à la fin des travaux ; les ruptures s'affichent au tableau de bord." },
  { icone: UsersRound, titre: "Toute l'équipe", texte: "Réception, mécaniciens, administration : chacun reçoit son invitation et ne voit que ce que son rôle permet." },
  { icone: MessageSquareText, titre: "Rappels et relances", texte: "Rappel par texto la veille du rendez-vous, et relance des réparations refusées, avec l'accord du client." },
  { icone: Star, titre: "Avis Google", texte: "Un bouton sur la facture envoie au client le lien vers votre fiche, au moment où il est satisfait." },
];

const FAQ = [
  {
    q: "Faut-il installer quelque chose ?",
    r: "Non. Garagenda s'ouvre dans le navigateur, sur l'ordinateur du comptoir, une tablette dans l'atelier ou un téléphone. Rien à installer ni à mettre à jour.",
  },
  {
    q: "Mes clients doivent-ils créer un compte ?",
    r: "Non. Ils reçoivent un lien : ils voient leur inspection, approuvent les réparations ou demandent un rendez-vous sans mot de passe.",
  },
  {
    q: "Où sont mes données ?",
    r: "La base de données est hébergée à Montréal. Chaque garage ne voit que ses propres données, et vous pouvez exporter le dossier complet d'un client à tout moment.",
  },
  {
    q: "Combien d'employés puis-je ajouter ?",
    r: "Autant que vous voulez, sans frais supplémentaires. Chacun reçoit une invitation par courriel et un rôle : réception, mécanicien ou administrateur.",
  },
  {
    q: "Est-ce que je m'engage ?",
    r: "Non. Vous essayez 14 jours gratuitement, puis c'est 99 $ par mois. L'abonnement s'annule en tout temps, depuis l'application.",
  },
];

function Surtitre({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mf-text-3">
      <span className="w-5 h-[3px] bg-mf-signal" aria-hidden />
      {children}
    </p>
  );
}

function BoutonEssai({ className = "", taille = "normal" }: { className?: string; taille?: "normal" | "grand" }) {
  return (
    <Link
      href="/inscription"
      className={`group inline-flex items-center justify-center gap-2 bg-mf-blue hover:bg-mf-blue-hover text-mf-on-blue font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mf-bg ${
        taille === "grand" ? "min-h-[52px] px-6 text-base" : "min-h-[44px] px-4 text-sm"
      } ${className}`}
    >
      Essayer gratuitement
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Check className="w-4 h-4 mt-1 shrink-0 text-mf-success" strokeWidth={3} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

export default function Vitrine() {
  return (
    <div className="min-h-screen bg-mf-bg text-mf-text overflow-x-clip">
      {/* ------------------------------------------------ En-tête */}
      <header className="sticky top-0 z-20 bg-mf-bg border-b border-mf-border">
        <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
          <Link href="/" aria-label="Garagenda — accueil" className="shrink-0">
            <Logo height={21} />
          </Link>
          <nav aria-label="Sections" className="hidden md:flex items-center gap-7 text-sm text-mf-text-2">
            <a href="#parcours" className="hover:text-mf-text">Comment ça marche</a>
            <a href="#quebec" className="hover:text-mf-text">Fait pour le Québec</a>
            <a href="#prix" className="hover:text-mf-text">Prix</a>
            <a href="#questions" className="hover:text-mf-text">Questions</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/login" className="text-sm font-semibold text-mf-text-2 hover:text-mf-text px-2 min-h-[44px] inline-flex items-center">
              Se connecter
            </Link>
            <BoutonEssai className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>

      <main>
        {/* ------------------------------------------------ Héros */}
        <section className="mx-auto max-w-6xl px-5 pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-10 items-center">
          <div>
            <Surtitre>Logiciel de gestion de garage · Québec</Surtitre>
            <h1 className="font-display font-bold text-[2.5rem] leading-[1.02] sm:text-6xl lg:text-[4.1rem] tracking-[-0.02em] mt-5 text-balance">
              Tout l&apos;atelier, du premier appel{" "}
              <span className="relative whitespace-nowrap">
                à la facture
                <span className="absolute left-0 right-0 -bottom-1 h-[6px] bg-mf-signal" aria-hidden />
              </span>
              .
            </h1>
            <p className="mt-7 text-lg text-mf-text-2 leading-relaxed max-w-xl">
              Bons de travail, évaluations écrites, inspections avec photos que le client approuve de son téléphone,
              factures TPS et TVQ exactes. En français, pensé pour les règles d&apos;ici.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-3">
              <BoutonEssai taille="grand" />
              <a
                href="#parcours"
                className="inline-flex items-center justify-center min-h-[52px] px-6 text-base font-semibold border border-mf-border-strong hover:bg-mf-surface-2"
              >
                Voir comment ça marche
              </a>
            </div>
            <p className="mt-4 text-sm text-mf-text-3">14 jours gratuits · 99 $ par mois ensuite · sans engagement</p>
          </div>

          {/* Deux points de vue sur le même moment : le bon au comptoir, et le
              téléphone du client qui approuve. Le téléphone chevauche à peine
              le bon, sans masquer ses montants ; sous 1024 px il reste seul. */}
          <div className="relative mx-auto w-full flex justify-center lg:block lg:h-[480px]">
            <MaquetteBon className="hidden lg:block absolute left-0 top-0 w-[290px]" />
            <MaquetteTelephone className="lg:absolute lg:-right-6 xl:right-0 lg:top-[92px]" />
          </div>
        </section>

        {/* ------------------------------------------------ Faits */}
        <section aria-label="En bref" className="border-y border-mf-border bg-mf-surface">
          <div className="mx-auto max-w-6xl grid grid-cols-2 lg:grid-cols-4 gap-px bg-mf-border">
            {[
              ["100 % en français", "Écrans, documents et courriels"],
              ["Hébergé à Montréal", "Vos données restent au Québec"],
              ["TPS 5 % · TVQ 9,975 %", "Calculées au cent près"],
              ["Loi 25", "Consentement, export, effacement"],
            ].map(([titre, sous]) => (
              <div key={titre} className="bg-mf-surface py-6 px-5">
                <div className="font-display font-bold text-base sm:text-lg">{titre}</div>
                <div className="text-sm text-mf-text-3 mt-0.5">{sous}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------ Parcours */}
        <section id="parcours" className="scroll-mt-20 mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <Surtitre>Comment ça marche</Surtitre>
          <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-[-0.015em] mt-4 max-w-3xl text-balance">
            Une voiture entre, une facture sort. Rien ne se perd entre les deux.
          </h2>
          <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-mf-border">
            {ETAPES.map((e, i) => (
              <li key={e.titre} className="border-r border-b border-mf-border bg-mf-surface p-6">
                <span className="font-mono text-sm font-semibold text-mf-signal-fg">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display font-bold text-xl mt-2">{e.titre}</h3>
                <p className="text-mf-text-2 mt-2 leading-relaxed">{e.texte}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ------------------------------------------------ Inspection */}
        <section className="border-t border-mf-border">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-14 items-center">
            <div className="order-2 lg:order-1 flex justify-center">
              <div className="relative">
                <div className="absolute -inset-6 sm:-inset-10 bg-mf-surface-2 border border-mf-border" aria-hidden />
                <MaquetteTelephone className="relative" />
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <Surtitre>Inspection numérique</Surtitre>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-[-0.015em] mt-4 text-balance">
                Le client voit ce que vous voyez. Il approuve de son téléphone.
              </h2>
              <p className="mt-5 text-lg text-mf-text-2 leading-relaxed">
                Plus besoin de le rappeler trois fois pour expliquer une usure qu&apos;il ne voit pas. Il reçoit un
                lien, regarde les photos, et répond réparation par réparation.
              </p>
              <ul className="mt-7 flex flex-col gap-3 text-mf-text">
                <Point>Photos par point d&apos;inspection, classées par urgence : à réparer, à surveiller, en bon état</Point>
                <Point>Le prix de chaque réparation, et le total approuvé qui se met à jour</Point>
                <Point>Sa réponse apparaît dans l&apos;atelier ; les réparations approuvées passent sur le bon d&apos;un clic</Point>
                <Point>Aucun compte à créer pour le client : un lien suffit</Point>
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Évaluation */}
        <section className="border-t border-mf-border bg-mf-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <Surtitre>Évaluation écrite</Surtitre>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-[-0.015em] mt-4 text-balance">
                Le prix accepté par le client est le prix facturé.
              </h2>
              <p className="mt-5 text-lg text-mf-text-2 leading-relaxed">
                Le litige le plus coûteux d&apos;un garage commence par « c&apos;est plus cher que prévu ». Garagenda ne
                vous laisse pas facturer au-dessus de l&apos;évaluation acceptée sans une nouvelle acceptation du client.
              </p>
              <ul className="mt-7 flex flex-col gap-3">
                <Point>Évaluation imprimable ou envoyée par courriel, avec TPS et TVQ estimées</Point>
                <Point>Acceptation ou renonciation écrite du client, datée à la minute</Point>
                <Point>Aucun travail démarré sans autorisation : le logiciel le refuse</Point>
                <Point>Une facture émise ne se modifie plus. On l&apos;annule, avec un motif, et la trace reste</Point>
              </ul>
            </div>
            <MaquetteDepassement />
          </div>
        </section>

        {/* ------------------------------------------------ Factures */}
        <section className="border-t border-mf-border">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-14 items-center">
            <div className="order-2 lg:order-1 pb-8 sm:pl-8">
              <MaquetteFacture />
            </div>
            <div className="order-1 lg:order-2">
              <Surtitre>Facturation</Surtitre>
              <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-[-0.015em] mt-4 text-balance">
                Des factures justes, et un comptable qui ne vous rappelle plus.
              </h2>
              <p className="mt-5 text-lg text-mf-text-2 leading-relaxed">
                Les taxes sont calculées au cent près et figées sur la facture. À la fin du trimestre, le rapport est
                prêt pour vos remises de TPS et de TVQ.
              </p>
              <ul className="mt-7 flex flex-col gap-3">
                <Point>Vos numéros de TPS et de TVQ imprimés sur chaque facture</Point>
                <Point>Numérotation continue, sans trou, propre à votre garage</Point>
                <Point>Paiements partiels et soldes impayés suivis au tableau de bord</Point>
                <Point>Rapport par année ou par trimestre, à imprimer ou à exporter pour Excel</Point>
              </ul>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Le reste */}
        <section className="border-t border-mf-border bg-mf-surface">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <Surtitre>Et tout le reste</Surtitre>
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-[-0.015em] mt-4 max-w-2xl text-balance">
              Tout ce qui vivait sur des bouts de papier.
            </h2>
            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-mf-border border border-mf-border">
              {AUSSI.map(({ icone: Icone, titre, texte }) => (
                <div key={titre} className="bg-mf-surface p-6">
                  <Icone className="w-5 h-5 text-mf-blue" aria-hidden />
                  <h3 className="font-display font-bold text-lg mt-4">{titre}</h3>
                  <p className="text-mf-text-2 mt-2 leading-relaxed">{texte}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Québec */}
        <section id="quebec" className="scroll-mt-16 bg-mf-sidebar-bg text-mf-sidebar-text">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mf-sidebar-text-2">
              <span className="w-5 h-[3px] bg-mf-signal" aria-hidden />
              Fait pour le Québec
            </p>
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-[-0.015em] mt-4 max-w-3xl text-balance">
              Pas un logiciel américain traduit. Un outil écrit pour les règles d&apos;ici.
            </h2>
            <div className="mt-14 grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {[
                { icone: ClipboardCheck, titre: "Protection du consommateur", texte: "Évaluation écrite avant les travaux ou renonciation du client, pièces remplacées remises sur demande, garantie inscrite sur la facture." },
                { icone: Gauge, titre: "TPS et TVQ", texte: "Taux québécois, arrondis comme il se doit, numéros d'inscription sur chaque document, rapport trimestriel pour vos remises." },
                { icone: ShieldCheck, titre: "Loi 25", texte: "Consentement distinct pour les communications, avis de confidentialité à votre nom, export et effacement du dossier d'un client." },
                { icone: MapPin, titre: "Données à Montréal", texte: "La base de données de votre garage est hébergée au Québec, cloisonnée de celle des autres garages." },
              ].map(({ icone: Icone, titre, texte }) => (
                <div key={titre} className="flex gap-4 border-t border-mf-sidebar-border pt-6">
                  <Icone className="w-5 h-5 mt-1 shrink-0 text-mf-signal" aria-hidden />
                  <div>
                    <h3 className="font-display font-bold text-xl">{titre}</h3>
                    <p className="mt-2 text-mf-sidebar-text-2 leading-relaxed">{texte}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Prix */}
        <section id="prix" className="scroll-mt-16 mx-auto max-w-6xl px-5 py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <Surtitre>Prix</Surtitre>
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-[-0.015em] mt-4 text-balance">
              Un seul forfait. Tout est inclus.
            </h2>
            <p className="mt-5 text-lg text-mf-text-2 leading-relaxed max-w-lg">
              Pas de module à débloquer, pas de frais par employé. Si une réparation approuvée de plus par mois grâce à
              l&apos;inspection photo couvre l&apos;abonnement, le reste est à vous.
            </p>
          </div>
          <div className="bg-mf-surface border-2 border-mf-text p-7 sm:p-9">
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-6xl tracking-[-0.03em]">99 $</span>
              <span className="text-mf-text-2">par mois, par garage</span>
            </div>
            <p className="text-sm text-mf-text-3 mt-1">14 jours d&apos;essai gratuit · annulable en tout temps</p>
            <ul className="mt-7 grid gap-3 border-t border-mf-border pt-7">
              <Point>Employés illimités, avec rôles</Point>
              <Point>Bons de travail, évaluations, inspections photo</Point>
              <Point>Factures, paiements et rapport pour le comptable</Point>
              <Point>Rendez-vous en ligne et arrivée au comptoir</Point>
              <Point>Inventaire et véhicules en stock</Point>
              <Point>Sur ordinateur, tablette et téléphone</Point>
            </ul>
            <BoutonEssai taille="grand" className="w-full mt-8" />
          </div>
        </section>

        {/* ------------------------------------------------ Questions */}
        <section id="questions" className="scroll-mt-16 border-t border-mf-border bg-mf-surface">
          <div className="mx-auto max-w-3xl px-5 py-20 sm:py-28">
            <Surtitre>Questions</Surtitre>
            <h2 className="font-display font-bold text-3xl sm:text-4xl tracking-[-0.015em] mt-4">Avant de commencer</h2>
            <div className="mt-10 border-t border-mf-border">
              {FAQ.map(({ q, r }) => (
                <details key={q} className="group border-b border-mf-border">
                  <summary className="flex items-center justify-between gap-4 py-5 cursor-pointer list-none font-semibold text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue [&::-webkit-details-marker]:hidden">
                    {q}
                    <span className="shrink-0 w-7 h-7 flex items-center justify-center border border-mf-border-strong font-mono text-mf-text-2 group-open:rotate-45 transition-transform" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="pb-6 -mt-1 text-mf-text-2 leading-relaxed max-w-prose">{r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Appel final */}
        <section className="border-t border-mf-border">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:py-24 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <h2 className="font-display font-bold text-3xl sm:text-5xl tracking-[-0.015em] max-w-2xl text-balance">
              Créez votre garage aujourd&apos;hui. Essayez-le avec votre prochaine voiture.
            </h2>
            <div className="flex flex-col items-start lg:items-end gap-3">
              <BoutonEssai taille="grand" />
              <p className="text-sm text-mf-text-3">Déjà client ? <Link href="/login" className="font-semibold text-mf-blue hover:underline">Se connecter</Link></p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-mf-border bg-mf-surface">
        <div className="mx-auto max-w-6xl px-5 py-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-sm text-mf-text-3">
          <div className="flex items-center gap-3">
            <Logo height={16} />
            <span>Logiciel de gestion de garage · Québec</span>
          </div>
          <nav aria-label="Liens utiles" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/login" className="hover:text-mf-text">Se connecter</Link>
            <Link href="/inscription" className="hover:text-mf-text">Créer un compte</Link>
            <Link href="/confidentialite" className="hover:text-mf-text">Politique de confidentialité</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
