"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Bell } from "./bell";

/** En-tête des onglets Activité et Compte ; l'Accueil a son propre haut d'écran, comme TapTap Send. */
export function AppTopBar({ unread, admin }: { unread: number; admin: boolean }) {
  const pathname = usePathname();
  if (pathname === "/app") return null;
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link href="/app" className="brand">
          <Logo size={24} />
          MEYA
        </Link>
        <div className="header-tools">
          {admin && <Link href="/admin" className="admin-link">Admin</Link>}
          <Bell unread={unread} />
        </div>
      </div>
    </header>
  );
}
