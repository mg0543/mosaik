import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalDate } from "@/components/local-date";
import { ProgressBar, StatusChip } from "@/components/orders";
import { averageRate, fmtEur, fmtGiven, fmtRate, fmtReceived, fmtXof, sideLabel } from "@/lib/format";
import { actionFor } from "@/lib/settlement";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getMyOrder } from "@/server/queries";
import { CancelForm } from "./cancel-form";
import { SettlementCard } from "./settlement-card";

export const metadata: Metadata = { title: "Détail de l'échange" };

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
  const now = new Date();
  const toDo = trades.filter((t) => t.settlement && actionFor(t.settlement, t.role)).length;

  return (
    <div className="app-page">
      <Link href="/app/activite" className="back-link">← Activité</Link>

      {nouveau && (
        <div className="notice success" role="status">
          <div>
            <strong>Échange enregistré.</strong>{" "}
            {trades.length > 0
              ? `${trades.length} partenaire${trades.length > 1 ? "s ont" : " a"} été trouvé${trades.length > 1 ? "s" : ""} tout de suite.`
              : "Votre demande est publiée : elle sera servie dès qu'un partenaire correspond."}
            {trades.length > 0 && order.remaining > 0 && " Le reste attend un autre partenaire."}
          </div>
        </div>
      )}

      {toDo > 0 && (
        <a href="#echanges" className="action-banner">
          <span className="action-dot" aria-hidden="true" />
          <span>
            <strong>À vous de jouer :</strong> {toDo} paiement{toDo > 1 ? "s attendent" : " attend"} votre action.
          </span>
          <span aria-hidden="true">↓</span>
        </a>
      )}

      <section className="card">
        <div className="card-body">
          <div className="order-item-top">
            <span className="order-side">{sideLabel(order.side)}</span>
            <StatusChip order={order} />
          </div>
          <div className="detail-flow">
            <div>
              <span className="detail-label">Vous envoyez</span>
              <span className="detail-amount num">{fmtGiven(order.side, order.amount)}</span>
            </div>
            <span className="detail-arrow" aria-hidden="true">→</span>
            <div>
              <span className="detail-label">Reçu à ce jour</span>
              <span className="detail-amount num">{fmtReceived(order.side, order.received)}</span>
            </div>
          </div>
          <ProgressBar order={order} />
          <dl className="facts">
            <div><dt>Déjà échangé</dt><dd className="num">{fmtGiven(order.side, order.given)}</dd></div>
            {order.status === "open" && (
              <div><dt>En attente d&apos;un partenaire</dt><dd className="num">{fmtGiven(order.side, order.remaining)}</dd></div>
            )}
            {order.status === "cancelled" && order.remaining > 0 && (
              <div><dt>Non échangé (annulé)</dt><dd className="num">{fmtGiven(order.side, order.remaining)}</dd></div>
            )}
            {trades.length > 0 && <div><dt>Taux obtenu</dt><dd className="num">1 € = {fmtRate(averageRate(trades))} XOF</dd></div>}
            <div>
              <dt>{sellXof ? "Taux accepté au plus" : "Taux accepté au moins"}</dt>
              <dd className="num">1 € = {fmtRate(order.limitRate)} XOF</dd>
            </div>
            <div><dt>Créé le</dt><dd><LocalDate date={order.createdAt} /></dd></div>
          </dl>
          {order.leftover > 0 && (
            <p className="warn-text">
              Reste technique : {fmtGiven(order.side, order.leftover)} restent chez vous. Ce montant vaut moins
              d&apos;1 centime d&apos;euro et ne pouvait pas être échangé.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="trades-title" id="echanges" className="anchor-target">
        <h2 id="trades-title" className="section-title">Vos partenaires ({trades.length})</h2>
        {trades.length === 0 ? (
          <div className="empty-state card">
            <p><strong>Pas encore de partenaire.</strong></p>
            <p className="muted">
              Votre demande est visible par les autres participants. Dès que quelqu&apos;un accepte votre taux, il
              apparaîtra ici avec les instructions de paiement.
            </p>
          </div>
        ) : (
          <ul className="trade-list">
            {trades.map((t, i) =>
              t.settlement ? (
                <SettlementCard key={t.id} index={i + 1} tradeId={t.id} orderId={order.id} role={t.role} rate={t.rate}
                  createdAt={t.createdAt} settlement={t.settlement} now={now} />
              ) : (
                <li key={t.id} className="card trade-item">
                  <div className="trade-head">
                    <span>Partenaire {i + 1}</span>
                    <span className="muted"><LocalDate date={t.createdAt} /></span>
                  </div>
                  <div className="trade-amounts num">
                    <span>Envoyé : {sellXof ? fmtXof(t.xof) : fmtEur(t.eurCents)}</span>
                    <span>Reçu : {sellXof ? fmtEur(t.eurCents) : fmtXof(t.xof)}</span>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </section>

      {order.status === "open" && <CancelForm orderId={order.id} remainingLabel={fmtGiven(order.side, order.remaining)} />}

      <p className="field-hint">
        Chaque échange se règle directement entre les deux partenaires : celui qui a accepté l&apos;offre paie en
        premier. MEYA ne reçoit ni ne transfère aucun argent.
      </p>
    </div>
  );
}
