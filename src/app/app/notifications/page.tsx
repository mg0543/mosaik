import type { Metadata } from "next";
import Link from "next/link";
import { LocalDate } from "@/components/local-date";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { listNotifications, type NotificationKind } from "@/server/notifications";
import { MarkRead } from "./mark-read";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<NotificationKind, string> = {
  trade_matched: "🤝",
  settlement_step: "💸",
  settlement_done: "✅",
  dispute_opened: "⚠️",
  dispute_resolved: "⚖️",
  order_cancelled: "✖️",
  account_suspended: "⛔",
  account_reactivated: "🔓",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await listNotifications(getSql(), user.id, 100);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="app-page">
      <h1 className="app-title">Notifications</h1>
      <MarkRead unread={unread} />
      {notifications.length === 0 ? (
        <div className="empty-state card">
          <p><strong>Aucune notification.</strong></p>
          <p className="muted">Vous serez prévenu ici quand un partenaire est trouvé ou qu&apos;un paiement avance.</p>
        </div>
      ) : (
        <ul className="notif-list">
          {notifications.map((n) => {
            const content = (
              <>
                <span className="notif-icon" aria-hidden="true">{ICONS[n.kind]}</span>
                <span className="notif-text">
                  <strong>{n.title}</strong>
                  <span>{n.body}</span>
                  <span className="notif-date"><LocalDate date={n.createdAt} /></span>
                </span>
                {!n.readAt && <span className="notif-dot" aria-label="Non lue" />}
              </>
            );
            return (
              <li key={n.id} className={n.readAt ? "notif" : "notif unread"}>
                {n.link ? <Link href={n.link} className="notif-link">{content}</Link> : <div className="notif-link">{content}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
