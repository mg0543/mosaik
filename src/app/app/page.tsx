import type { Metadata } from "next";
import Link from "next/link";
import { OrderListItem } from "@/components/orders";
import { fmtEur, fmtRate, fmtXof } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { LocalDate } from "@/components/local-date";
import { getMarketSnapshot, getMyOrders } from "@/server/queries";
import { getPendingActions } from "@/server/settlements";

export const metadata: Metadata = { title: "Accueil" };

export default async function DashboardPage() {
  const user = await requireUser();
  const sql = getSql();
  const [market, orders, toDo] = await Promise.all([
    getMarketSnapshot(sql),
    getMyOrders(sql, user.id, 20),
    getPendingActions(sql, user.id),
  ]);
  const open = orders.filter((o) => o.status === "open");
  const recent = orders.slice(0, 5);

  return (
    <div className="app-page">
      <h1 className="app-title">Bonjour</h1>
      <p className="muted app-subtitle">{user.email}</p>

      {toDo.length > 0 && (
        <section className="card todo-card" aria-labelledby="todo-title">
          <div className="card-body">
            <h2 id="todo-title" className="section-title" style={{ marginTop: 0 }}>
              À faire ({toDo.length})
            </h2>
            <ul className="todo-list">
              {toDo.map((a) => (
                <li key={a.tradeId}>
                  <Link href={"/app/ordres/" + a.orderId}>
                    <strong>
                      {a.step === "taker_sent" || a.step === "maker_sent" ? "Envoyer votre paiement" : "Confirmer une réception"}
                    </strong>
                    <span className="muted"> · avant le <LocalDate date={a.dueAt} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="market-grid compact" aria-label="Marché">
        <div className="card market-card">
          <div className="stat-label">Pour obtenir des euros</div>
          {market.bestEurOffer !== null ? (
            <>
              <div className="market-rate num">{fmtRate(market.bestEurOffer)} <span>XOF / €</span></div>
              <div className="stat-sub num">{fmtEur(market.eurAvailableCents)} disponibles</div>
            </>
          ) : (
            <div className="stat-sub market-empty">Aucune offre</div>
          )}
        </div>
        <div className="card market-card">
          <div className="stat-label">Pour obtenir des XOF</div>
          {market.bestXofOffer !== null ? (
            <>
              <div className="market-rate num">{fmtRate(market.bestXofOffer)} <span>XOF / €</span></div>
              <div className="stat-sub num">{fmtXof(market.xofAvailable)} disponibles</div>
            </>
          ) : (
            <div className="stat-sub market-empty">Aucune offre</div>
          )}
        </div>
      </section>

      <Link href="/app/echanger" className="btn btn-primary btn-lg btn-block">Nouvel échange</Link>

      <section aria-labelledby="recent-title">
        <div className="section-head">
          <h2 id="recent-title" className="section-title">Mes ordres récents</h2>
          {orders.length > 0 && (
            <Link href="/app/ordres" className="link-more">
              Tout voir{open.length > 0 ? ` · ${open.length} en attente` : ""}
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="empty-state card">
            <p>Vous n&apos;avez encore passé aucun ordre.</p>
            <p className="muted">Choisissez un montant et votre taux : Mosaik cherche les contreparties pour vous.</p>
          </div>
        ) : (
          <ul className="order-list">
            {recent.map((o) => <OrderListItem key={o.id} order={o} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
