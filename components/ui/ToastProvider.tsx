"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X, type LucideIcon } from "lucide-react";

type Severite = "success" | "warning" | "danger" | "info";
type ToastItem = { id: number; titre: string; description?: string; severite: Severite };

const BORDURE: Record<Severite, string> = {
  success: "border-l-mf-success",
  warning: "border-l-mf-warning",
  danger: "border-l-mf-red",
  info: "border-l-mf-blue",
};
const ICONE: Record<Severite, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};
const COULEUR_ICONE: Record<Severite, string> = {
  success: "text-mf-success",
  warning: "text-mf-warning",
  danger: "text-mf-red",
  info: "text-mf-blue",
};

const ToastContext = createContext<{
  afficher: (t: { titre: string; description?: string; severite?: Severite }) => void;
} | null>(null);

// Pas encore appelé nulle part dans le projet (voir DESIGN_AUDIT.md) —
// posé en Phase 2 pour être prêt dès qu'un écran en a besoin.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de <ToastProvider>.");
  return ctx;
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const retirer = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const afficher = useCallback(
    ({ titre, description, severite = "info" }: { titre: string; description?: string; severite?: Severite }) => {
      const id = ++idRef.current;
      setToasts((t) => [...t, { id, titre, description, severite }]);
      setTimeout(() => retirer(id), 5000);
    },
    [retirer]
  );

  return (
    <ToastContext.Provider value={{ afficher }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 sm:px-0 pointer-events-none">
        {toasts.map((t) => {
          const Icone = ICONE[t.severite];
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 bg-mf-surface-2 border border-mf-border border-l-[3px] ${BORDURE[t.severite]} rounded-mf-md shadow-mf-lg px-4 py-3`}
            >
              <Icone className={`w-4 h-4 shrink-0 mt-0.5 ${COULEUR_ICONE[t.severite]}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-mf-text">{t.titre}</p>
                {t.description && <p className="text-xs text-mf-text-2 mt-0.5">{t.description}</p>}
              </div>
              <button
                onClick={() => retirer(t.id)}
                aria-label="Fermer"
                className="text-mf-text-3 hover:text-mf-text w-6 h-6 flex items-center justify-center -mr-1 -mt-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
