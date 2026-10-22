import type { Metadata } from "next";
import Link from "next/link";
import { OrderListItem } from "@/components/orders";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getMyOrders } from "@/server/queries";

export const metadata: Metadata = { title: "Mes échanges" };

export default async function OrdersPage() {
  const user = await requireUser();
  const orders = await getMyOrders(getSql(), user.id, 100);
  const open = orders.filter((o) => o.status === "open");
  const closed = orders.filter((o) => o.status !== "open");

  return (
    <div className="app-page">
      <h1 className="app-title">Mes échanges</h1>
      {orders.length === 0 ? (
        <div className="empty-state card">
          <p>Aucun échange pour l&apos;instant.</p>
          <Link href="/app/echanger" className="btn btn-primary">Faire un premier échange</Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="open-title">
            <h2 id="open-title" className="section-title">En cours ({open.length})</h2>
            {open.length === 0 ? (
              <p className="muted">Aucune demande en attente.</p>
            ) : (
              <ul className="order-list">{open.map((o) => <OrderListItem key={o.id} order={o} />)}</ul>
            )}
          </section>
          {closed.length > 0 && (
            <section aria-labelledby="closed-title">
              <h2 id="closed-title" className="section-title">Terminés ({closed.length})</h2>
              <ul className="order-list">{closed.map((o) => <OrderListItem key={o.id} order={o} />)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
