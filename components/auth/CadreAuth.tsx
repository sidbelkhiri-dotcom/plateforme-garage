import Logo from "@/components/Logo";

// Cadre commun des écrans hors connexion : connexion, inscription, mot de
// passe oublié, nouveau mot de passe. Un titre qui dit où l'on est — le
// logo seul ne le disait pas — et une marge extérieure pour que la carte
// ne colle pas aux bords d'un téléphone.
export default function CadreAuth({
  titre,
  sousTitre,
  children,
  pied,
}: {
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  pied?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-mf-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo height={24} />
        </div>
        <div className="bg-mf-surface border border-mf-border rounded-mf-lg shadow-mf-lg p-6 sm:p-8">
          <h1 className="font-display text-xl font-bold text-mf-text text-balance">{titre}</h1>
          {sousTitre && <p className="mt-1 text-sm text-mf-text-2">{sousTitre}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {pied && <div className="mt-5 text-center text-sm text-mf-text-2">{pied}</div>}
      </div>
    </div>
  );
}

export function MessageAuth({ ton, children }: { ton: "erreur" | "info" | "succes"; children: React.ReactNode }) {
  const couleurs = {
    erreur: "bg-mf-red-soft border-mf-red text-mf-red",
    info: "bg-mf-blue-soft border-mf-blue text-mf-text",
    succes: "bg-mf-success-soft border-mf-success text-mf-text",
  }[ton];
  return (
    <div role={ton === "erreur" ? "alert" : "status"} className={`mb-4 border rounded-mf-sm px-3 py-2 text-sm ${couleurs}`}>
      {children}
    </div>
  );
}
