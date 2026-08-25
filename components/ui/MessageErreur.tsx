import { AlertCircle } from "lucide-react";

// Toute erreur Supabase s'affiche ici, jamais avalée (D15, règle §6.2).
export default function MessageErreur({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 bg-mf-red-soft border border-mf-red text-mf-red rounded-mf-sm px-3 py-2 text-sm ${className}`}
    >
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
