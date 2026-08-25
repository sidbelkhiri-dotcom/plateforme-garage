import { Loader2 } from "lucide-react";

export default function Chargement({ message = "Chargement..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-mf-text-3 py-8 justify-center">
      <Loader2 className="w-4 h-4 animate-spin" />
      {message}
    </div>
  );
}
