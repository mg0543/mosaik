import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar, StatusChip } from "@/components/orders";
import { LocalDate } from "@/components/local-date";
import { averageRate, fmtEur, fmtGiven, fmtPct, fmtRate, fmtReceived, fmtXof, sideLabel } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getMyOrder } from "@/server/queries";
import { CancelForm } from "./cancel-form";

export const metadata: Metadata = { title: "Détail de l'ordre" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nouveau?: string }>;
}) {
  const user = await requireUser();
  const [{ id }, { nouveau }] = await Promise.all([params, searchParams]);
  const data = await getMyOrder(getSql(), user.id, id);
  if (!data) notFound();
  const { order, trades } = data;
  const sellXof = order.side === "SELL_XOF";

  return (
    <div className="app-page">
      <Link href="/app/ordres" className="back-link">← Mes ordres</Link>

      {nouveau && (
        <div className="notice success" role="status">
          <div>
            <strong>Ordre enregistré.</strong>{" "}
            {trades.length > 0
              ? `Servi tout de suite par ${trades.length} contrepartie${trades.length > 1 ? "s" : ""}.`
              : "Il attend dans le carnet qu'une contrepartie le croise."}
          </div>
        </div>
      )}

      <section className="card">
        <div className="card-body">
          <div className="order-item-top">
            <span className="order-side">{sideLabel(order.side)}</span>
            <StatusChip order={order} />
          </div>
          <div className="detail-amount num">{fmtGiven(order.side, order.amount)}</div>
          <ProgressBar order={order} />
          <dl className="facts">
            <div><dt>Échangé</dt><dd className="num">{fmtGiven(order.side, order.given)} ({fmtPct(order.given, order.amount)})</dd></div>
            <div><dt>Reçu</dt><dd className="num">{fmtReceived(order.side, order.received)}</dd></div>
            {trades.length > 0 && <div><dt>Taux moyen obtenu</dt><dd className="num">{fmtRate(averageRate(trades))} XOF / €</dd></div>}
            <div><dt>{sellXof ? "Taux maximum" : "Taux minimum"}</dt><dd className="num">{fmtRate(order.limitRate)} XOF / €</dd></div>
            {order.status === "open" && <div><dt>En attente</dt><dd className="num">{fmtGiven(order.side, order.remaining)}</dd></div>}
            {order.status === "cancelled" && order.remaining > 0 && (
              <div><dt>Non échangé (annulé)</dt><dd className="num">{fmtGiven(order.side, order.remaining)}</dd></div>
            )}
            <div><dt>Passé le</dt><dd><LocalDate date={order.createdAt} /></dd></div>
          </dl>
          {order.leftover > 0 && (
            <p className="warn-text">
              Reste technique : {fmtGiven(order.side, order.leftover)} restent chez vous. Ce montant vaut moins
              d&apos;1 centime d&apos;euro et ne pouvait pas être échangé.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="trades-title">
        <h2 id="trades-title" className="section-title">Échanges ({trades.length})</h2>
        {trades.length === 0 ? (
          <p className="muted">Aucun échange pour l&apos;instant.</p>
        ) : (
          <ul className="trade-list">
            {trades.map((t, i) => (
              <li key={t.id} className="card trade-item">
                <div className="trade-head">
                  <span>Contrepartie {i + 1}</span>
                  <span className="muted"><LocalDate date={t.createdAt} /></span>
                </div>
                <div className="trade-amounts num">
                  <span>Donné : {sellXof ? fmtXof(t.xof) : fmtEur(t.eurCents)}</span>
                  <span>Reçu : {sellXof ? fmtEur(t.eurCents) : fmtXof(t.xof)}</span>
                </div>
                <div className="muted trade-rate">
                  Taux {fmtRate(t.rate)} · {t.role === "maker" ? "votre ordre attendait dans le carnet" : "servi à l'arrivée de votre ordre"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {order.status === "open" && <CancelForm orderId={order.id} remainingLabel={fmtGiven(order.side, order.remaining)} />}

      <p className="field-hint">
        Mosaik enregistre l&apos;appariement ; le règlement entre participants a lieu hors de la plateforme
        pendant le pilote.
      </p>
    </div>
  );
}
