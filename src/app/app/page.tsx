import type { Metadata } from "next";
import Link from "next/link";
import { Converter } from "@/components/converter";
import { LocalDate } from "@/components/local-date";
import { OrderListItem } from "@/components/orders";
import { payToFor } from "@/lib/payment";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getProfile } from "@/server/profiles";
import { getBookForUser, getMyOrders } from "@/server/queries";
import { getPaymentDetails, getPendingActions } from "@/server/settlements";

export const metadata: Metadata = { title: "Accueil" };

export default async function DashboardPage() {
  const user = await requireUser();
  const sql = getSql();
  const [orders, toDo, profile, book, details] = await Promise.all([
    getMyOrders(sql, user.id, 5),
    getPendingActions(sql, user.id),
    getProfile(sql, user.id),
    getBookForUser(sql, user.id),
    getPaymentDetails(sql, user.id),
  ]);
  const canReceive = { SELL_XOF: payToFor(details, "EUR") !== null, SELL_EUR: payToFor(details, "XOF") !== null };

  return (
    <div className="app-page">
      <div>
        <h1 className="app-title">Bonjour{profile.firstName ? ` ${profile.firstName}` : ""} 👋</h1>
        <p className="muted app-subtitle-plain">Combien voulez-vous échanger aujourd&apos;hui ?</p>
      </div>

      {toDo.length > 0 && (
        <section className="todo-banner" aria-labelledby="todo-title">
          <h2 id="todo-title">À faire ({toDo.length})</h2>
          <ul className="todo-list">
            {toDo.map((a) => (
              <li key={a.tradeId}>
                <Link href={`/app/ordres/${a.orderId}#echanges`}>
                  <strong>
                    {a.step === "taker_sent" || a.step === "maker_sent" ? "Envoyer votre paiement" : "Confirmer une réception"}
                  </strong>
                  <span className="muted"> · avant le <LocalDate date={a.dueAt} /></span>
                  <span className="todo-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card converter-card" aria-label="Nouvel échange">
        <div className="card-body">
          <Converter book={book} mode="app" canReceive={canReceive} />
        </div>
      </section>

      <section aria-labelledby="recent-title">
        <div className="section-head">
          <h2 id="recent-title" className="section-title">Mes derniers échanges</h2>
          {orders.length > 0 && <Link href="/app/ordres" className="link-more">Tout voir</Link>}
        </div>
        {orders.length === 0 ? (
          <div className="empty-state card">
            <p><strong>Aucun échange pour l&apos;instant.</strong></p>
            <p className="muted">Indiquez un montant ci-dessus : MEYA vous montre tout de suite ce que vous recevez.</p>
          </div>
        ) : (
          <ul className="order-list">
            {orders.map((o) => <OrderListItem key={o.id} order={o} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
