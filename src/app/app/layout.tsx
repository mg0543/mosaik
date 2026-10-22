import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { unreadCount } from "@/server/notifications";
import { getProfile } from "@/server/profiles";
import { isSuperAdmin } from "@/server/roles";
import { InstallHint } from "./install-hint";
import { Intro } from "./intro";
import { AppNav } from "./nav";

export const metadata: Metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const sql = getSql();
  const [unread, admin, profile] = await Promise.all([
    unreadCount(sql, user.id),
    isSuperAdmin(sql, user.id),
    getProfile(sql, user.id),
  ]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/app" className="brand">
            <Logo size={24} />
            MEYA
          </Link>
          <span className="tag">Pilote</span>
          <div className="header-tools">
            {admin && <Link href="/admin" className="admin-link">Admin</Link>}
            <Link href="/app/notifications" className="bell"
              aria-label={unread > 0 ? `Notifications : ${unread} non lue${unread > 1 ? "s" : ""}` : "Notifications"}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unread > 0 && <span className="bell-badge num">{unread > 9 ? "9+" : unread}</span>}
            </Link>
          </div>
        </div>
      </header>
      <main className="app-main">
        {profile.suspendedAt && (
          <div className="notice warn" role="status">
            <div>
              <strong>Votre compte est suspendu.</strong> Vous ne pouvez plus créer d&apos;échange ; vos règlements en
              cours restent accessibles. Motif : {profile.suspendedReason}
            </div>
          </div>
        )}
        <Intro />
        <InstallHint />
        {children}
      </main>
      <AppNav />
    </div>
  );
}
