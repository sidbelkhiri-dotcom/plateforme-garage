import type { LucideIcon } from "lucide-react";

export default function EtatVide({
  icone: Icone,
  titre,
  message,
  action,
}: {
  icone: LucideIcon;
  titre: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 text-mf-text-3">
      <Icone className="w-8 h-8 mb-3 text-mf-text-3" />
      <p className="font-semibold text-mf-text-2">{titre}</p>
      {message && <p className="text-sm mt-1 max-w-sm">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
