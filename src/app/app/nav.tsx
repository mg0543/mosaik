"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/app", label: "Accueil", icon: "home" },
  { href: "/app/echanger", label: "Échanger", icon: "swap" },
  { href: "/app/ordres", label: "Mes ordres", icon: "list" },
  { href: "/app/compte", label: "Compte", icon: "user" },
] as const;

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

/** Navigation de l'espace connecté : en haut sur ordinateur, en barre d'onglets sur mobile. */
export function AppNav({ variant }: { variant: "top" | "tabs" }) {
  const pathname = usePathname();
  return (
    <nav className={variant === "top" ? "topnav" : "tabbar"} aria-label="Navigation principale">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={isActive(pathname, tab.href) ? "page" : undefined}>
          {variant === "tabs" && <TabIcon name={tab.icon} />}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function TabIcon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  const paths: Record<typeof name, string> = {
    home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
    swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
    list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
