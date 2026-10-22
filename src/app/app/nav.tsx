"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Trois onglets d'application, toujours en bas : Accueil, Activité, Compte. */
const TABS = [
  { href: "/app", label: "Accueil", icon: "home" },
  { href: "/app/activite", label: "Activité", icon: "activity" },
  { href: "/app/compte", label: "Compte", icon: "user" },
] as const;

const isActive = (pathname: string, href: string) => {
  if (href === "/app") return pathname === "/app" || pathname.startsWith("/app/notifications");
  // Le détail d'un échange appartient à l'onglet Activité.
  if (href === "/app/activite") return pathname.startsWith("/app/activite") || pathname.startsWith("/app/ordres");
  return pathname.startsWith(href);
};

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={isActive(pathname, tab.href) ? "page" : undefined}>
          <TabIcon name={tab.icon} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function TabIcon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const paths: Record<typeof name, string> = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
    activity: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
