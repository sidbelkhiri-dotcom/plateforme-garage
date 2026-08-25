import Link from "next/link";
import { Wrench } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-mf-bg p-6">
      <div className="text-center max-w-sm">
        <Wrench className="w-10 h-10 text-mf-blue mx-auto mb-4" />
        <div className="font-display font-black text-5xl text-mf-text mb-2">404</div>
        <h1 className="font-display font-bold uppercase tracking-wide text-mf-text mb-2">Page introuvable</h1>
        <p className="text-sm text-mf-text-2 mb-6">
          Cette page n'existe pas ou plus.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-mf-sm text-sm font-semibold bg-mf-blue hover:bg-mf-blue-hover text-white transition-colors"
        >
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
