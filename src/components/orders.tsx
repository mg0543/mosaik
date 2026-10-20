import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { fmtGiven, fmtPct, fmtRate, fmtReceived, sideLabel } from "@/lib/format";
import { orderStatus } from "@/lib/order-status";
import type { MyOrder } from "@/server/queries";

export function StatusChip({ order }: { order: Pick<MyOrder, "status" | "given"> }) {
  const { label, tone } = orderStatus(order);
  return <span className={`chip chip-${tone}`}>{label}</span>;
}

/** Barre de progression : part de l'ordre déjà échangée. */
export function ProgressBar({ order }: { order: Pick<MyOrder, "amount" | "given"> }) {
  return (
    <div className="progress" role="img" aria-label={`${fmtPct(order.given, order.amount)} échangé`}>
      <div style={{ width: `${Math.min(100, (order.given / order.amount) * 100)}%` }} />
    </div>
  );
}

export function OrderListItem({ order }: { order: MyOrder }) {
  return (
    <li>
      <Link href={`/app/ordres/${order.id}`} className="order-item">
        <div className="order-item-top">
          <span className="order-side">{sideLabel(order.side)}</span>
          <StatusChip order={order} />
        </div>
        <div className="order-item-amount num">{fmtGiven(order.side, order.amount)}</div>
        <ProgressBar order={order} />
        <div className="order-item-meta">
          <span className="num">
            {order.given > 0 ? `Reçu ${fmtReceived(order.side, order.received)}` : `Taux ${order.side === "SELL_XOF" ? "max." : "min."} ${fmtRate(order.limitRate)}`}
          </span>
          <LocalDate date={order.createdAt} />
        </div>
      </Link>
    </li>
  );
}
