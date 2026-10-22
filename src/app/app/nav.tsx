"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Trois onglets, comme les applications de transfert d'argent : envoyer, suivre, son compte. */
const TABS = [
  { href: "/app", label: "Envoyer", icon: "send" },
  { href: "/app/activite", label: "Activité", icon: "activity" },
  { href: "/app/compte", label: "Compte", icon: "user" },
] as const;

const isActive = (pathname: string, href: string) => {
  if (href === "/app") return pathname === "/app";
  // Le détail d'un échange appartient à l'onglet Activité.
  if (href === "/app/activite") return pathname.startsWith("/app/activite") || pathname.startsWith("/app/ordres");
  return pathname.startsWith(href);
};

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
    send: "M4 12h13M12 5l7 7-7 7",
    activity: "M3 12h4l3-8 4 16 3-8h4",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  };
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
