import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { actionLabel } from "@/lib/audit-labels";
import { fmtXofNumber } from "@/lib/format";
import { getOverview } from "@/server/admin";
import { listAuditEvents } from "@/server/audit";
import { requireAdmin } from "@/server/auth";
import { getSql } from "@/server/db";

export const metadata = { title: "Vue d'ensemble" };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const sql = getSql();
  const [o, events] = await Promise.all([getOverview(sql), listAuditEvents(sql, { limit: 12 })]);

  const tiles = [
    { label: "Utilisateurs", value: o.users, sub: `+${o.newUsers7d} sur 7 jours`, href: "/admin/utilisateurs" },
    { label: "Demandes ouvertes", value: o.openOrders, sub: "en attente d'un partenaire", href: "/admin/echanges" },
    { label: "Échanges (24 h)", value: o.trades24h, sub: `${fmtXofNumber(o.volume30dXof)} XOF sur 30 jours`, href: "/admin/echanges" },
    { label: "Règlements en cours", value: o.pendingSettlements, sub: `${o.lateSettlements} en retard`, href: "/admin/echanges", alert: o.lateSettlements > 0 },
    { label: "Litiges à trancher", value: o.openDisputes, sub: "règlements gelés", href: "/admin/litiges", alert: o.openDisputes > 0 },
    { label: "Comptes suspendus", value: o.suspended, sub: "ne peuvent plus échanger", href: "/admin/utilisateurs" },
  ];

  return (
    <div className="admin-page">
      <h1 className="app-title">Vue d&apos;ensemble</h1>
      <div className="admin-tiles">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={t.alert ? "admin-tile alert" : "admin-tile"}>
            <span className="admin-tile-label">{t.label}</span>
            <strong className="num">{t.value}</strong>
            <span className="admin-tile-sub">{t.sub}</span>
          </Link>
        ))}
      </div>

      <section className="card">
        <div className="card-body">
          <div className="section-head">
            <h2 className="section-title" style={{ marginTop: 0 }}>Activité récente</h2>
            <Link href="/admin/audit" className="link-more">Tout le journal</Link>
          </div>
          {events.length === 0 ? (
            <p className="muted">Aucun événement pour l&apos;instant.</p>
          ) : (
            <ul className="audit-list">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`audit-role ${e.actorRole}`}>{e.actorRole === "admin" ? "admin" : e.actorRole === "system" ? "système" : "utilisateur"}</span>
                  <strong>{actionLabel(e.action)}</strong>
                  <span className="muted">{e.actorEmail ?? (typeof e.details.email === "string" ? e.details.email : "—")}</span>
                  <span className="muted audit-date"><LocalDate date={e.at} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
