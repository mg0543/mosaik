"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/utilisateurs", label: "Utilisateurs" },
  { href: "/admin/echanges", label: "Échanges" },
  { href: "/admin/litiges", label: "Litiges" },
  { href: "/admin/audit", label: "Journal d'audit" },
  { href: "/admin/invitations", label: "Invitations" },
  { href: "/admin/systeme", label: "Système" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Sections d'administration">
      {SECTIONS.map((s) => {
        const active = s.href === "/admin" ? pathname === "/admin" : pathname.startsWith(s.href);
        return (
          <Link key={s.href} href={s.href} aria-current={active ? "page" : undefined}>{s.label}</Link>
        );
      })}
    </nav>
  );
}
