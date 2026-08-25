"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-5 py-3 text-sm text-mf-text-2 hover:bg-mf-surface-2 hover:text-mf-text transition-colors min-h-[44px]"
    >
      <LogOut className="w-4 h-4" />
      Déconnexion
    </button>
  );
}
