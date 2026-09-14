import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatTelephone } from "@/lib/texte";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vos renseignements personnels",
  robots: { index: false },
};

type GaragePublic = {
  nom: string;
  adresse: string | null;
  telephone: string | null;
  courriel: string | null;
  rprp_nom: string | null;
  rprp_titre: string | null;
  rprp_courriel: string | null;
};

// Avis de confidentialité d'un garage, lié depuis ses formulaires publics
// (arrivée au comptoir, demande de rendez-vous).
//
// La Loi 25 demande d'informer la personne, au moment de la collecte, des
// fins, des moyens, de ses droits (accès, rectification, retrait du
// consentement) et de la possibilité que les renseignements soient
// communiqués hors du Québec ; et de publier le titre et les coordonnées du
// responsable. Chaque garage est l'entreprise responsable : l'avis est à
// son nom, alimenté par ses Paramètres. Garagenda n'y figure que comme
// prestataire.
//
// Rédigé pour être lu par un client au comptoir, pas par un juriste : des
// phrases courtes, et rien qui ne soit vrai du logiciel tel qu'il est.
export default async function ConfidentialiteGarage({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data } = await supabase.rpc("obtenir_garage_public", { p_slug: params.slug });
  const garage = data as GaragePublic | null;
  if (!garage) notFound();

  const contact = garage.rprp_courriel ?? garage.courriel;

  return (
    <div className="min-h-screen bg-mf-bg px-4 py-10">
      <article className="mx-auto w-full max-w-2xl bg-mf-surface border border-mf-border p-6 sm:p-10 text-mf-text">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mf-text-3">{garage.nom}</p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mt-2 text-balance">Vos renseignements personnels</h1>
        <p className="text-sm text-mf-text-2 mt-3 max-w-prose">
          Ce que {garage.nom} recueille à votre sujet, pourquoi, qui y a accès et comment exercer vos droits.
        </p>

        <div className="mt-8 flex flex-col gap-8 text-[0.9375rem] leading-relaxed max-w-prose">
          <Section titre="Qui est responsable">
            <p>
              {garage.nom}
              {garage.adresse ? `, ${garage.adresse}` : ""}, est responsable des renseignements que vous lui confiez.
            </p>
            {garage.rprp_nom ? (
              <p>
                Responsable de la protection des renseignements personnels :{" "}
                <strong>{garage.rprp_nom}</strong>
                {garage.rprp_titre ? `, ${garage.rprp_titre}` : ""}
                {garage.rprp_courriel && (
                  <>
                    {" "}
                    —{" "}
                    <a href={`mailto:${garage.rprp_courriel}`} className="text-mf-blue font-semibold underline underline-offset-2">
                      {garage.rprp_courriel}
                    </a>
                  </>
                )}
                .
              </p>
            ) : (
              <p>
                Pour toute question, communiquez avec le garage
                {garage.telephone ? ` au ${formatTelephone(garage.telephone)}` : ""}
                {garage.courriel ? ` ou à ${garage.courriel}` : ""}.
              </p>
            )}
          </Section>

          <Section titre="Ce que nous recueillons, et pourquoi">
            <Liste>
              <li>
                <strong>Votre nom, votre téléphone, votre courriel et votre adresse</strong> — pour vous joindre au sujet
                de votre véhicule, vous remettre une évaluation écrite et vous facturer.
              </li>
              <li>
                <strong>Votre véhicule</strong> (marque, modèle, année, plaque, numéro d&apos;identification, kilométrage)
                — pour l&apos;identifier et tenir son historique d&apos;entretien.
              </li>
              <li>
                <strong>Le problème décrit et les travaux faits</strong>, avec d&apos;éventuelles photos du véhicule —
                pour poser le diagnostic, vous montrer ce qui est recommandé et garantir le travail.
              </li>
              <li>
                <strong>Les paiements</strong> — pour tenir la comptabilité du garage.
              </li>
            </Liste>
            <p>
              Ces renseignements sont recueillis directement auprès de vous : au comptoir, par téléphone, ou par les
              formulaires en ligne du garage. Ils ne servent à rien d&apos;autre.
            </p>
          </Section>

          <Section titre="Rappels et offres">
            <p>
              Le garage ne vous envoie de rappels d&apos;entretien, de demandes d&apos;avis ou d&apos;offres que si vous
              l&apos;avez accepté, par une case distincte que vous cochez vous-même. Vous pouvez retirer ce consentement
              à tout moment, en le demandant au garage.
            </p>
          </Section>

          <Section titre="Qui y a accès">
            <Liste>
              <li>Le personnel du garage, selon son rôle (réception, mécaniciens, administration).</li>
              <li>
                Garagenda, le logiciel de gestion qu&apos;utilise le garage, en tant que prestataire : il héberge ces
                renseignements pour le garage et ne les utilise pas pour son propre compte.
              </li>
              <li>
                Les fournisseurs techniques de Garagenda (hébergement des données, envoi des courriels et des textos). <strong>Certains sont situés à l&apos;extérieur du Québec</strong> ; ils sont liés
                par contrat à des mesures de sécurité.
              </li>
            </Liste>
            <p>Vos renseignements ne sont ni vendus ni loués.</p>
          </Section>

          <Section titre="Combien de temps">
            <Liste>
              <li>
                <strong>Factures et dossiers de travaux</strong> : six ans, durée exigée par les lois fiscales.
              </li>
              <li>
                <strong>Demandes envoyées en ligne</strong> : effacées 90 jours après avoir été traitées, et au plus tard
                après un an.
              </li>
              <li>
                <strong>Votre fiche client</strong> : tant que vous faites affaire avec le garage, ou jusqu&apos;à ce que
                vous en demandiez l&apos;effacement. Les factures, que la loi oblige à conserver, restent alors seules.
              </li>
            </Liste>
          </Section>

          <Section titre="Vos droits">
            <Liste>
              <li>Savoir quels renseignements le garage détient sur vous, et en obtenir une copie.</li>
              <li>Faire corriger un renseignement inexact ou incomplet.</li>
              <li>Recevoir vos renseignements dans un format électronique structuré, pour les transmettre ailleurs.</li>
              <li>Retirer votre consentement aux rappels et aux offres.</li>
              <li>Demander l&apos;effacement de votre fiche, sous réserve des documents que la loi oblige à conserver.</li>
            </Liste>
            <p>
              Faites votre demande {contact ? (
                <>
                  à{" "}
                  <a href={`mailto:${contact}`} className="text-mf-blue font-semibold underline underline-offset-2">
                    {contact}
                  </a>
                </>
              ) : (
                "au garage"
              )}
              . Le garage vous répond dans un délai de 30 jours. Si la réponse ne vous satisfait pas, vous pouvez vous
              adresser à la{" "}
              <a
                href="https://www.cai.gouv.qc.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mf-blue font-semibold underline underline-offset-2"
              >
                Commission d&apos;accès à l&apos;information du Québec
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-mf-border flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link href={`/accueil/${params.slug}/rendez-vous`} className="font-semibold text-mf-blue hover:underline">
            ← Demander un rendez-vous
          </Link>
          <span className="text-xs text-mf-text-3">Propulsé par Garagenda</span>
        </div>
      </article>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-base font-bold uppercase tracking-wide text-mf-text">{titre}</h2>
      {children}
    </section>
  );
}

function Liste({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc pl-5 flex flex-col gap-2 marker:text-mf-signal-fg">{children}</ul>;
}
