import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { fmtGiven, fmtRate, sideLabel } from "@/lib/format";
import { listAllOrders } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { getSql } from "@/server/db";
import { cancelOrderAdminAction } from "../actions";
import { AdminForm } from "../forms";

export const metadata = { title: "Échanges" };

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "open", label: "Ouvertes" },
  { value: "filled", label: "Servies" },
  { value: "cancelled", label: "Annulées" },
] as const;

const STATUS: Record<string, string> = { open: "Ouverte", filled: "Servie", cancelled: "Annulée" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requireAdmin();
  const { statut } = await searchParams;
  const status = statut === "open" || statut === "filled" || statut === "cancelled" ? statut : undefined;
  const orders = await listAllOrders(getSql(), { status });

  return (
    <div className="admin-page">
      <h1 className="app-title">Demandes et échanges ({orders.length})</h1>
      <nav className="admin-filters" aria-label="Filtrer par statut">
        {FILTERS.map((f) => (
          <Link key={f.value} href={f.value ? `/admin/echanges?statut=${f.value}` : "/admin/echanges"}
            aria-current={(status ?? "") === f.value ? "page" : undefined}>{f.label}</Link>
        ))}
      </nav>
      <ul className="admin-list">
        {orders.map((o) => (
          <li key={o.id} className="admin-row">
            <div className="admin-row-main">
              <strong className="num">{fmtGiven(o.side, o.amount)}</strong>
              <span className={`chip ${o.status === "open" ? "chip-open" : o.status === "filled" ? "chip-done" : "chip-off"}`}>{STATUS[o.status]}</span>
              <span className="muted">{sideLabel(o.side)} · {o.ownerEmail}</span>
              <span className="muted admin-meta">
                Taux limite {fmtRate(o.limitRate)} · reste {fmtGiven(o.side, o.remaining)} · {o.trades} échange{o.trades > 1 ? "s" : ""} ·{" "}
                <LocalDate date={o.createdAt} /> · réf. {o.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div className="admin-row-actions">
              {o.status === "open" && (
                <AdminForm action={cancelOrderAdminAction} hidden={{ orderId: o.id }} label="Confirmer l'annulation" danger
                  confirm="Annuler" reasonLabel="Motif (communiqué à l'utilisateur)" />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
