import { Loader2 } from "lucide-react";

// Couleurs de marque MECAFORCE — voir BRAND.md. Contrastes vérifiés par
// calcul de luminance réelle : blanc sur mf-blue = 5.71:1, blanc sur
// mf-red = 4.83:1 (AA texte normal, seuil 4.5).
const VARIANTES = {
  primaire: "bg-mf-blue hover:bg-mf-blue-hover text-white hover:-translate-y-px",
  secondaire: "bg-transparent hover:bg-mf-surface-2 text-mf-text border border-mf-border-strong",
  danger: "bg-mf-red hover:bg-mf-red-hover text-white",
  discret: "text-mf-text-2 hover:text-mf-text hover:bg-mf-surface-2",
} as const;

type VarianteBouton = keyof typeof VARIANTES;

export default function Bouton({
  children,
  variante = "primaire",
  enEnvoi = false,
  type = "button",
  className = "",
  ...props
}: {
  children: React.ReactNode;
  variante?: VarianteBouton;
  enEnvoi?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={enEnvoi || props.disabled}
      className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-mf-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-150 ease-[cubic-bezier(.2,.8,.2,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue focus-visible:ring-offset-2 focus-visible:ring-offset-mf-bg ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {enEnvoi && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
