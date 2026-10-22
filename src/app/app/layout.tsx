import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { requireUser } from "@/server/auth";
import { AppNav } from "./nav";
import { InstallHint } from "./install-hint";
import { Intro } from "./intro";

export const metadata: Metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/app" className="brand">
            <Logo size={24} />
            MEYA
          </Link>
          <span className="tag">Pilote</span>
          <AppNav variant="top" />
        </div>
      </header>
      <main className="app-main">
        <Intro />
        <InstallHint />
        {children}
      </main>
      <AppNav variant="tabs" />
    </div>
  );
}
