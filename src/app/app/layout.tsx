import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { unreadCount } from "@/server/notifications";
import { getProfile } from "@/server/profiles";
import { isSuperAdmin } from "@/server/roles";
import { InstallHint } from "./install-hint";
import { Intro } from "./intro";
import { AppNav } from "./nav";
import { AppTopBar } from "./top-bar";

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
      <AppTopBar unread={unread} admin={admin} />
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
