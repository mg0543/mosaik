import type { Queryable } from "./db";

/**
 * Notifications dans l'application (la cloche). Elles sont créées par le serveur, dans la même
 * transaction que l'événement qui les déclenche. L'envoi par e-mail viendra avec le service d'e-mail.
 */

export type NotificationKind =
  | "trade_matched"
  | "settlement_step"
  | "settlement_done"
  | "dispute_opened"
  | "dispute_resolved"
  | "order_cancelled"
  | "account_suspended"
  | "account_reactivated";

export interface NewNotification {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Lien interne vers la page concernée (commence par « / »). */
  link?: string;
}

export interface Notification extends NewNotification {
  id: string;
  createdAt: Date;
  readAt: Date | null;
}

export async function notify(sql: Queryable, userId: string, n: NewNotification): Promise<void> {
  await sql`
    insert into public.notifications (user_id, kind, title, body, link)
    values (${userId}, ${n.kind}, ${n.title}, ${n.body}, ${n.link ?? null})
  `;
}

export async function listNotifications(sql: Queryable, userId: string, limit = 50): Promise<Notification[]> {
  const rows = await sql<
    { id: string; kind: NotificationKind; title: string; body: string; link: string | null; created_at: Date; read_at: Date | null }[]
  >`
    select id, kind, title, body, link, created_at, read_at
    from public.notifications where user_id = ${userId}
    order by created_at desc, id
    limit ${limit}
  `;
  return rows.map((r) => ({
    id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link ?? undefined, createdAt: r.created_at, readAt: r.read_at,
  }));
}

export async function unreadCount(sql: Queryable, userId: string): Promise<number> {
  const [row] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.notifications where user_id = ${userId} and read_at is null
  `;
  return row.n;
}

/** Marque toutes les notifications de l'utilisateur comme lues ; renvoie leur nombre. */
export async function markAllRead(sql: Queryable, userId: string): Promise<number> {
  const rows = await sql`
    update public.notifications set read_at = now()
    where user_id = ${userId} and read_at is null
    returning id
  `;
  return rows.length;
}
