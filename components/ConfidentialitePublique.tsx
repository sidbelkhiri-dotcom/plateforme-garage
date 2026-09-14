// Mentions de confidentialité des formulaires publics d'un garage (arrivée
// au comptoir, demande de rendez-vous).
//
// Deux choses distinctes, et la Loi 25 exige qu'elles le restent :
//   - l'avis de collecte, qui informe : à qui vont les renseignements, pour
//     quoi, et où lire le détail de ses droits ;
//   - le consentement aux communications (rappels d'entretien, demandes
//     d'avis, offres), qui dépasse la demande elle-même : demandé à part,
//     jamais coché d'avance, et facultatif — refuser n'empêche pas d'envoyer
//     le formulaire.

export function ConsentementCommunications({
  nomGarage,
  coche,
  surChangement,
}: {
  nomGarage: string;
  coche: boolean;
  surChangement: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 text-sm text-mf-text min-h-[44px] py-1 cursor-pointer">
      <input
        type="checkbox"
        checked={coche}
        onChange={(e) => surChangement(e.target.checked)}
        className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--mf-blue)]"
      />
      <span>
        J&apos;accepte que {nomGarage} m&apos;envoie des rappels d&apos;entretien, des demandes d&apos;avis et des offres
        par courriel ou par texto. <span className="text-mf-text-3">Facultatif — vous pouvez le retirer à tout moment.</span>
      </span>
    </label>
  );
}

export function AvisCollecte({ nomGarage, slug, finalite }: { nomGarage: string; slug: string; finalite: string }) {
  return (
    <p className="text-xs text-mf-text-3 leading-relaxed">
      Vos renseignements sont transmis à {nomGarage} pour {finalite}, et à personne d&apos;autre que ses prestataires
      techniques, dont certains hors du Québec. Vous pouvez y accéder, les faire corriger ou en demander l&apos;effacement.{" "}
      <a
        href={`/accueil/${slug}/confidentialite`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-mf-blue underline underline-offset-2"
      >
        Vos renseignements personnels
      </a>
    </p>
  );
}
