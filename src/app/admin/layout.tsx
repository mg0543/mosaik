import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { requireAdmin } from "@/server/auth";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin MEYA" }, robots: { index: false } };

/** Console du super administrateur : réservée, revérifiée côté serveur à chaque page. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <Link href="/admin" className="brand">
          <Logo size={24} />
          MEYA <span className="admin-badge">Super admin</span>
        </Link>
        <span className="muted admin-who">{admin.email}</span>
        <Link href="/app" className="btn btn-secondary btn-sm">Retour à l&apos;app</Link>
      </header>
      <div className="admin-body">
        <AdminNav />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
