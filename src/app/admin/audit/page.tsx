import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { actionLabel, AUDIT_FILTERS } from "@/lib/audit-labels";
import { listAuditEvents } from "@/server/audit";
import { requireAdmin } from "@/server/auth";
import { getSql } from "@/server/db";

export const metadata = { title: "Journal d'audit" };

const PAGE = 100;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ type?: string; avant?: string }> }) {
  await requireAdmin();
  const { type, avant } = await searchParams;
  const action = AUDIT_FILTERS.some((f) => f.value === type) ? type : "";
  const beforeId = avant && /^\d+$/.test(avant) ? Number(avant) : undefined;
  const events = await listAuditEvents(getSql(), { limit: PAGE, action: action || undefined, beforeId });
  const last = events.at(-1);

  return (
    <div className="admin-page">
      <h1 className="app-title">Journal d&apos;audit</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Chaque action importante est enregistrée ici. Le journal ne peut être ni modifié ni effacé.
      </p>
      <nav className="admin-filters" aria-label="Filtrer par type">
        {AUDIT_FILTERS.map((f) => (
          <Link key={f.value} href={f.value ? `/admin/audit?type=${encodeURIComponent(f.value)}` : "/admin/audit"}
            aria-current={action === f.value ? "page" : undefined}>{f.label}</Link>
        ))}
      </nav>
      <div className="table-wrap card admin-table">
        <table>
          <thead>
            <tr><th>Date</th><th>Action</th><th>Par</th><th>Objet</th><th>Détails</th></tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td><LocalDate date={e.at} /></td>
                <td><strong>{actionLabel(e.action)}</strong></td>
                <td>
                  <span className={`audit-role ${e.actorRole}`}>{e.actorRole === "admin" ? "admin" : e.actorRole === "system" ? "système" : "utilisateur"}</span>{" "}
                  {e.actorEmail ?? "—"}
                </td>
                <td className="muted">{e.entity}{e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}</td>
                <td className="muted audit-details">
                  {Object.entries(e.details).map(([k, v]) => `${k} : ${String(v)}`).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length === PAGE && last && (
        <Link className="btn btn-secondary" href={`/admin/audit?${new URLSearchParams({ ...(action ? { type: action } : {}), avant: String(last.id) })}`}>
          Événements plus anciens
        </Link>
      )}
    </div>
  );
}
