import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { ENTREPRISE, PRESTATAIRES } from "@/lib/garagenda";
import { formatDateLong } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Garagenda",
};

// Politique de confidentialité de Garagenda lui-même.
//
// Deux rôles, qu'il faut distinguer pour dire vrai :
//   - entreprise responsable des renseignements de ses propres clients :
//     les garages abonnés et leurs employés (comptes, abonnement) ;
//   - prestataire des garages pour les renseignements de LEURS clients
//     (fiches, véhicules, factures) : chaque garage en reste responsable et
//     publie son propre avis (/accueil/[slug]/confidentialite).
//
// Chaque affirmation correspond au logiciel tel qu'il est : aucun traceur,
// aucun outil d'analyse, cookies de session seulement.
export default function PolitiqueConfidentialite() {
  const nom = ENTREPRISE.nom ?? "L'exploitant de Garagenda";
  return (
    <div className="min-h-screen bg-mf-bg px-4 py-10">
      <article className="mx-auto w-full max-w-2xl bg-mf-surface border border-mf-border p-6 sm:p-10 text-mf-text">
        <Link href="/login" aria-label="Garagenda — connexion">
          <Logo height={22} />
        </Link>
        <h1 className="font-display text-2xl sm:text-3xl font-bold mt-6 text-balance">Politique de confidentialité</h1>
        <p className="text-sm text-mf-text-3 mt-2">Mise à jour le {formatDateLong(ENTREPRISE.miseAJour)}</p>

        {!ENTREPRISE.responsable && (
          <p className="mt-4 border border-mf-warning bg-mf-warning-soft text-mf-text text-sm px-3 py-2">
            Version préliminaire : l&apos;identité du responsable de la protection des renseignements personnels et
            l&apos;évaluation des prestataires situés hors du Québec restent à finaliser.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-8 text-[0.9375rem] leading-relaxed max-w-prose">
          <Section titre="Deux rôles">
            <p>
              <strong>Pour les garages abonnés et leurs employés</strong>, {nom} est responsable des renseignements
              nécessaires au compte et à l&apos;abonnement.
            </p>
            <p>
              <strong>Pour les clients des garages</strong> (fiches, véhicules, évaluations, factures), Garagenda agit
              comme prestataire : il héberge et traite ces renseignements pour le garage, sur ses instructions, et ne
              les utilise jamais pour son propre compte. Chaque garage en demeure responsable et publie son propre avis
              de confidentialité, accessible depuis ses formulaires en ligne.
            </p>
          </Section>

          <Section titre="Ce que nous recueillons">
            <Liste>
              <li>
                <strong>Compte</strong> : nom, courriel, mot de passe (conservé sous forme chiffrée, jamais lisible),
                rôle dans le garage.
              </li>
              <li>
                <strong>Garage</strong> : nom, adresse, téléphone, numéros de TPS et de TVQ, réglages.
              </li>
              <li>
                <strong>Abonnement</strong> : l&apos;état du paiement. Les données de carte sont saisies chez Stripe et
                ne passent jamais par Garagenda.
              </li>
              <li>
                <strong>Journaux techniques</strong> : dates de connexion et adresses IP, pour la sécurité des comptes.
              </li>
            </Liste>
          </Section>

          <Section titre="Pourquoi">
            <p>
              Pour fournir le service, sécuriser l&apos;accès, facturer l&apos;abonnement et vous écrire au sujet de
              votre compte. Aucune publicité, aucune revente, aucun profilage.
            </p>
          </Section>

          <Section titre="Témoins (cookies)">
            <p>
              Garagenda n&apos;utilise que les témoins nécessaires pour vous garder connecté. Aucun outil de mesure
              d&apos;audience, aucun traceur publicitaire.
            </p>
          </Section>

          <Section titre="Prestataires et hébergement">
            <Liste>
              {PRESTATAIRES.map((p) => (
                <li key={p.nom}>
                  <strong>{p.nom}</strong> — {p.role}
                </li>
              ))}
            </Liste>
            <p>
              <strong>Certains de ces prestataires sont situés à l&apos;extérieur du Québec</strong>, notamment aux
              États-Unis. Ces communications font l&apos;objet d&apos;une évaluation des facteurs relatifs à la vie
              privée, et chaque prestataire est lié par ses conditions contractuelles à des mesures de sécurité.
            </p>
          </Section>

          <Section titre="Combien de temps">
            <p>
              Les renseignements du compte sont conservés tant que l&apos;abonnement est actif. À la fin de
              l&apos;abonnement, le garage peut exporter ses données, puis en demander la suppression, sauf ce que la loi
              oblige à conserver.
            </p>
          </Section>

          <Section titre="Sécurité">
            <p>
              Chaque garage ne voit que ses propres données, cloison vérifiée par une batterie de tests automatisés.
              Les échanges sont chiffrés. En cas d&apos;incident de confidentialité présentant un risque de préjudice
              sérieux, les personnes concernées et la Commission d&apos;accès à l&apos;information sont avisées.
            </p>
          </Section>

          <Section titre="Vos droits et nous joindre">
            <p>
              Vous pouvez accéder à vos renseignements, les faire corriger, en obtenir une copie dans un format
              structuré, et en demander la suppression. Nous répondons dans un délai de 30 jours.
            </p>
            <p>
              Responsable de la protection des renseignements personnels :{" "}
              {ENTREPRISE.responsable ? (
                <>
                  <strong>{ENTREPRISE.responsable}</strong>
                  {ENTREPRISE.titreResponsable ? `, ${ENTREPRISE.titreResponsable}` : ""}
                </>
              ) : (
                <em>à publier</em>
              )}
              {ENTREPRISE.courriel && (
                <>
                  {" "}
                  —{" "}
                  <a href={`mailto:${ENTREPRISE.courriel}`} className="text-mf-blue font-semibold underline underline-offset-2">
                    {ENTREPRISE.courriel}
                  </a>
                </>
              )}
              .
            </p>
            <p>
              Client d&apos;un garage ? Adressez-vous d&apos;abord à ce garage, responsable de votre dossier. Vous pouvez
              aussi porter plainte à la{" "}
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
