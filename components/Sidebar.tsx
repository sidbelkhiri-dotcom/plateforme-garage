"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, X, Users, Calendar, CalendarClock, ClipboardList, Package, Settings, UserPlus, Receipt, Car } from "lucide-react";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";
import SelecteurGarageAdmin from "./SelecteurGarageAdmin";
import { useProfil } from "@/lib/useProfil";
import { useNouvellesArrivees } from "@/lib/useNouvellesArrivees";
import { useDemandesRendezVous } from "@/lib/useDemandesRendezVous";

// Règle C1 : seules les routes qui existent réellement apparaissent ici.
// Une page ajoutée dans un lot futur ajoute sa propre ligne, pas avant.
const nav = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, adminSeulement: false, receptionSeulement: false },
  { href: "/clients", label: "Clients", icon: Users, adminSeulement: false, receptionSeulement: false },
  { href: "/demandes-accueil", label: "Nouvelles arrivées", icon: UserPlus, adminSeulement: false, receptionSeulement: true },
  { href: "/demandes-rendez-vous", label: "Demandes de RDV", icon: CalendarClock, adminSeulement: false, receptionSeulement: true },
  { href: "/rendez-vous", label: "Rendez-vous", icon: Calendar, adminSeulement: false, receptionSeulement: false },
  { href: "/bons-travail", label: "Bons de travail", icon: ClipboardList, adminSeulement: false, receptionSeulement: false },
  { href: "/factures", label: "Factures", icon: Receipt, adminSeulement: false, receptionSeulement: false },
  { href: "/inventaire", label: "Inventaire", icon: Package, adminSeulement: false, receptionSeulement: false },
  { href: "/vehicules-stock", label: "Véhicules en stock", icon: Car, adminSeulement: false, receptionSeulement: false },
  { href: "/parametres", label: "Paramètres", icon: Settings, adminSeulement: true, receptionSeulement: false },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const { estAdmin, peutGererClients } = useProfil();
  const nouvellesArrivees = useNouvellesArrivees(peutGererClients);
  const demandesRdv = useDemandesRendezVous(peutGererClients);
  if (pathname === "/login" || pathname === "/inscription" || pathname.startsWith("/accueil")) return null;

  const liensNav = (
    <nav className="flex-1 py-3">
      {nav
        .filter((n) => (!n.adminSeulement || estAdmin) && (!n.receptionSeulement || peutGererClients))
        .map((n) => {
        const Icon = n.icon;
        const active =
          pathname === n.href ||
          (n.href !== "/" && pathname.startsWith(n.href + "/")) ||
          (n.href === "/clients" && pathname.startsWith("/vehicules/"));
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOuvert(false)}
            className={`relative w-full flex items-center gap-3 pl-5 pr-4 py-3 text-sm transition-colors min-h-[44px] ${
              active
                ? "bg-mf-surface-2 text-mf-text"
                : "text-mf-text-2 hover:bg-mf-surface-2/60 hover:text-mf-text"
            }`}
          >
            {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-mf-pill bg-mf-blue" />}
            <Icon className="w-4 h-4" />
            {n.label}
            {n.href === "/demandes-accueil" && nouvellesArrivees > 0 && (
              <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 rounded-mf-pill bg-mf-red text-white text-[11px] font-bold">
                {nouvellesArrivees}
              </span>
            )}
            {n.href === "/demandes-rendez-vous" && demandesRdv > 0 && (
              <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 rounded-mf-pill bg-mf-red text-white text-[11px] font-bold">
                {demandesRdv}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* < 768px : barre du haut + tiroir, la barre latérale fixe ne
          tiendrait pas sur un écran de téléphone (D17). */}
      <div className="sans-impression md:hidden flex items-center justify-between bg-mf-bg border-b border-mf-border text-mf-text px-4 h-14 shrink-0">
        <Logo height={18} />
        <button
          onClick={() => setOuvert(true)}
          className="relative w-11 h-11 flex items-center justify-center -mr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue rounded-mf-sm"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
          {nouvellesArrivees + demandesRdv > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-mf-red" />
          )}
        </button>
      </div>

      {ouvert && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-mf-bg text-mf-text-2 flex flex-col min-h-screen border-r border-mf-border">
            <div className="px-5 py-5 border-b border-mf-border flex items-center justify-between">
              <Logo height={18} />
              <button
                onClick={() => setOuvert(false)}
                className="w-11 h-11 -mr-2 flex items-center justify-center text-mf-text-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-mf-blue rounded-mf-sm"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <SelecteurGarageAdmin />
            {liensNav}
            <div className="border-t border-mf-border">
              <ThemeToggle />
              <LogoutButton />
            </div>
          </div>
          <button
            className="flex-1 bg-[var(--mf-overlay)]"
            onClick={() => setOuvert(false)}
            aria-label="Fermer le menu"
          />
        </div>
      )}

      {/* ≥ 768px : barre latérale fixe, comme avant. */}
      <aside className="sans-impression hidden md:flex w-56 bg-mf-bg text-mf-text-2 flex-col shrink-0 min-h-screen border-r border-mf-border">
        <div className="px-5 py-5 border-b border-mf-border">
          <Logo height={22} />
          <div className="text-[10px] text-mf-text-3 tracking-wide mt-1.5">GESTION D'ATELIER</div>
        </div>
        <SelecteurGarageAdmin />
        {liensNav}
        <div className="border-t border-mf-border">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
