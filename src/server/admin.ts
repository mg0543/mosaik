import { REFERENCE_RATE, type Side } from "../lib/matching";
import { recordEvent } from "./audit";
import type { Queryable, Sql } from "./db";
import { notify } from "./notifications";
import { ORDER_BOOK_LOCK } from "./orders";
import { isSuperAdmin } from "./roles";

export { isSuperAdmin };

/**
 * Console du super administrateur. Le rôle est revérifié par chaque page et chaque action
 * (requireAdmin dans auth.ts).
 * Toutes les actions laissent une trace dans le journal d'audit.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accorde le rôle de super administrateur à un compte existant (opération de base, tracée). */
export async function grantSuperAdmin(sql: Queryable, userId: string, grantedBy: string | null): Promise<void> {
  await sql`
    insert into public.app_roles (user_id, role, granted_by) values (${userId}, 'super_admin', ${grantedBy})
    on conflict (user_id) do nothing
  `;
  await recordEvent(sql, { actorId: grantedBy, actorRole: grantedBy ? "admin" : "system", action: "admin.role_granted", entity: "user", entityId: userId });
}

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------

export interface Overview {
  users: number;
  newUsers7d: number;
  suspended: number;
  openOrders: number;
  trades24h: number;
  volume30dXof: number;
  openDisputes: number;
  pendingSettlements: number;
  lateSettlements: number;
}

export async function getOverview(sql: Queryable): Promise<Overview> {
  const [r] = await sql<Overview[]>`
    select
      (select count(*)::int from auth.users) as "users",
      (select count(*)::int from auth.users where created_at > now() - interval '7 days') as "newUsers7d",
      (select count(*)::int from public.profiles where suspended_at is not null) as "suspended",
      (select count(*)::int from public.orders where status = 'open') as "openOrders",
      (select count(*)::int from public.trades where created_at > now() - interval '24 hours') as "trades24h",
      (select coalesce(sum(xof), 0)::bigint from public.trades where created_at > now() - interval '30 days') as "volume30dXof",
      (select count(*)::int from public.settlements where disputed_at is not null and resolved_at is null) as "openDisputes",
      (select count(*)::int from public.settlements where disputed_at is null and taker_received_at is null) as "pendingSettlements",
      (select count(*)::int from public.settlements where disputed_at is null and taker_received_at is null and due_at < now()) as "lateSettlements"
  `;
  return r;
}

// ---------------------------------------------------------------------------
// Utilisateurs
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  createdAt: Date;
  lastSignInAt: Date | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  isAdmin: boolean;
  orders: number;
  trades: number;
}

export async function listUsers(sql: Queryable, options: { search?: string; limit?: number } = {}): Promise<AdminUser[]> {
  const search = options.search?.trim().toLowerCase();
  const rows = await sql<
    { id: string; email: string; first_name: string | null; last_name: string | null; phone: string | null; created_at: Date; last_sign_in_at: Date | null; suspended_at: Date | null; suspended_reason: string | null; is_admin: boolean; orders: number; trades: number }[]
  >`
    select u.id, u.email, p.first_name, p.last_name, p.phone, u.created_at, u.last_sign_in_at,
           p.suspended_at, p.suspended_reason,
           exists (select 1 from public.app_roles r where r.user_id = u.id) as is_admin,
           (select count(*)::int from public.orders o where o.owner_id = u.id) as orders,
           (select count(*)::int from public.trades t where t.maker_id = u.id or t.taker_id = u.id) as trades
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where true
      ${search ? sql`and (lower(u.email) like ${`%${search}%`} or lower(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) like ${`%${search}%`})` : sql``}
    order by u.created_at desc
    limit ${options.limit ?? 200}
  `;
  return rows.map((r) => ({
    id: r.id, email: r.email, firstName: r.first_name, lastName: r.last_name, phone: r.phone,
    createdAt: r.created_at, lastSignInAt: r.last_sign_in_at, suspendedAt: r.suspended_at,
    suspendedReason: r.suspended_reason, isAdmin: r.is_admin, orders: r.orders, trades: r.trades,
  }));
}

/** Suspend un compte : il ne peut plus créer d'échange ; ses règlements en cours restent accessibles. */
export async function suspendUser(sql: Sql, adminId: string, userId: string, reason: string): Promise<void> {
  const text = reason.replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > 500) throw new RangeError("Indiquez un motif de 3 à 500 caractères.");
  if (!UUID.test(userId)) throw new RangeError("Utilisateur introuvable.");
  if (userId === adminId) throw new RangeError("Vous ne pouvez pas suspendre votre propre compte.");
  await sql.begin(async (tx) => {
    if (await isSuperAdmin(tx, userId)) throw new RangeError("Un administrateur ne peut pas être suspendu.");
    const rows = await tx`
      update public.profiles set suspended_at = now(), suspended_reason = ${text}
      where user_id = ${userId} and suspended_at is null
      returning user_id
    `;
    if (rows.length !== 1) throw new RangeError("Ce compte est déjà suspendu ou introuvable.");
    await recordEvent(tx, { actorId: adminId, actorRole: "admin", action: "user.suspended", entity: "user", entityId: userId, details: { reason: text } });
    await notify(tx, userId, {
      kind: "account_suspended",
      title: "Votre compte est suspendu",
      body: `Vous ne pouvez plus créer d'échange. Vos règlements en cours restent accessibles. Motif : ${text}`,
      link: "/app/compte",
    });
  });
}

export async function reactivateUser(sql: Sql, adminId: string, userId: string): Promise<void> {
  if (!UUID.test(userId)) throw new RangeError("Utilisateur introuvable.");
  await sql.begin(async (tx) => {
    const rows = await tx`
      update public.profiles set suspended_at = null, suspended_reason = null
      where user_id = ${userId} and suspended_at is not null
      returning user_id
    `;
    if (rows.length !== 1) throw new RangeError("Ce compte n'est pas suspendu.");
    await recordEvent(tx, { actorId: adminId, actorRole: "admin", action: "user.reactivated", entity: "user", entityId: userId });
    await notify(tx, userId, { kind: "account_reactivated", title: "Votre compte est réactivé", body: "Vous pouvez de nouveau créer des échanges.", link: "/app" });
  });
}

// ---------------------------------------------------------------------------
// Échanges
// ---------------------------------------------------------------------------

export interface AdminOrder {
  id: string;
  ownerEmail: string;
  side: Side;
  amount: number;
  remaining: number;
  limitRate: number;
  status: "open" | "filled" | "cancelled";
  createdAt: Date;
  trades: number;
}

export async function listAllOrders(sql: Queryable, options: { status?: "open" | "filled" | "cancelled"; limit?: number } = {}): Promise<AdminOrder[]> {
  const rows = await sql<
    { id: string; email: string; side: Side; amount: number; remaining: number; limit_rate: number; status: AdminOrder["status"]; created_at: Date; trades: number }[]
  >`
    select o.id, u.email, o.side, o.amount, o.remaining, o.limit_rate, o.status, o.created_at,
           (select count(*)::int from public.trades t where t.maker_order_id = o.id or t.taker_order_id = o.id) as trades
    from public.orders o join auth.users u on u.id = o.owner_id
    where true ${options.status ? sql`and o.status = ${options.status}` : sql``}
    order by o.created_at desc
    limit ${options.limit ?? 200}
  `;
  return rows.map((r) => ({
    id: r.id, ownerEmail: r.email, side: r.side, amount: r.amount, remaining: r.remaining, limitRate: r.limit_rate,
    status: r.status, createdAt: r.created_at, trades: r.trades,
  }));
}

/** Annule une demande ouverte, quel que soit son propriétaire, sous le verrou du carnet. */
export async function adminCancelOrder(sql: Sql, adminId: string, orderId: string, reason: string): Promise<void> {
  const text = reason.replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > 500) throw new RangeError("Indiquez un motif de 3 à 500 caractères.");
  if (!UUID.test(orderId)) throw new RangeError("Demande introuvable.");
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${ORDER_BOOK_LOCK})`;
    const rows = await tx<{ owner_id: string; remaining: number }[]>`
      update public.orders set status = 'cancelled'
      where id = ${orderId} and status = 'open'
      returning owner_id, remaining
    `;
    if (rows.length !== 1) throw new RangeError("Cette demande n'est plus ouverte.");
    await recordEvent(tx, { actorId: adminId, actorRole: "admin", action: "order.cancelled_by_admin", entity: "order", entityId: orderId, details: { reason: text, remaining: rows[0].remaining } });
    await notify(tx, rows[0].owner_id, {
      kind: "order_cancelled",
      title: "Une de vos demandes a été annulée",
      body: `L'équipe MEYA a annulé la partie en attente de votre demande. Motif : ${text}`,
      link: `/app/ordres/${orderId}`,
    });
  });
}

// ---------------------------------------------------------------------------
// Litiges
// ---------------------------------------------------------------------------

export interface AdminDispute {
  tradeId: string;
  disputedAt: Date;
  disputedByEmail: string;
  reason: string;
  takerEmail: string;
  makerEmail: string;
  takerCurrency: "EUR" | "XOF";
  takerAmount: number;
  makerAmount: number;
  steps: { takerSent: boolean; makerReceived: boolean; makerSent: boolean };
  resolvedAt: Date | null;
  resolution: "completed" | "failed" | null;
  resolutionNote: string | null;
}

export async function listDisputes(sql: Queryable, options: { open?: boolean } = {}): Promise<AdminDispute[]> {
  const rows = await sql<
    { trade_id: string; disputed_at: Date; by_email: string; dispute_reason: string; taker_email: string; maker_email: string; taker_currency: "EUR" | "XOF"; taker_amount: number; maker_amount: number; taker_sent: boolean; maker_received: boolean; maker_sent: boolean; resolved_at: Date | null; resolution: "completed" | "failed" | null; resolution_note: string | null }[]
  >`
    select s.trade_id, s.disputed_at, ub.email as by_email, s.dispute_reason, ut.email as taker_email, um.email as maker_email,
           s.taker_currency, s.taker_amount, s.maker_amount,
           s.taker_sent_at is not null as taker_sent, s.maker_received_at is not null as maker_received,
           s.maker_sent_at is not null as maker_sent, s.resolved_at, s.resolution, s.resolution_note
    from public.settlements s
    join auth.users ut on ut.id = s.taker_id
    join auth.users um on um.id = s.maker_id
    left join auth.users ub on ub.id = s.disputed_by
    where s.disputed_at is not null
      ${options.open ? sql`and s.resolved_at is null` : sql``}
    order by s.resolved_at nulls first, s.disputed_at desc
  `;
  return rows.map((r) => ({
    tradeId: r.trade_id, disputedAt: r.disputed_at, disputedByEmail: r.by_email ?? "compte supprimé", reason: r.dispute_reason,
    takerEmail: r.taker_email, makerEmail: r.maker_email, takerCurrency: r.taker_currency,
    takerAmount: r.taker_amount, makerAmount: r.maker_amount,
    steps: { takerSent: r.taker_sent, makerReceived: r.maker_received, makerSent: r.maker_sent },
    resolvedAt: r.resolved_at, resolution: r.resolution, resolutionNote: r.resolution_note,
  }));
}

/** Tranche un litige : « réglé » (les paiements ont bien eu lieu) ou « échoué ». Décision définitive. */
export async function resolveDispute(
  sql: Sql,
  adminId: string,
  tradeId: string,
  resolution: "completed" | "failed",
  note: string,
): Promise<void> {
  const text = note.replace(/\s+/g, " ").trim();
  if (text.length < 3 || text.length > 1000) throw new RangeError("Expliquez la décision en 3 à 1 000 caractères.");
  if (!UUID.test(tradeId)) throw new RangeError("Litige introuvable.");
  await sql.begin(async (tx) => {
    const rows = await tx<{ taker_id: string; maker_id: string; taker_order_id: string; maker_order_id: string }[]>`
      update public.settlements s
      set resolved_at = now(), resolved_by = ${adminId}, resolution = ${resolution}, resolution_note = ${text}
      from public.trades t
      where s.trade_id = ${tradeId} and t.id = s.trade_id and s.disputed_at is not null and s.resolved_at is null
      returning s.taker_id, s.maker_id, t.taker_order_id, t.maker_order_id
    `;
    if (rows.length !== 1) throw new RangeError("Ce litige est déjà tranché ou introuvable.");
    const r = rows[0];
    await recordEvent(tx, { actorId: adminId, actorRole: "admin", action: "dispute.resolved", entity: "trade", entityId: tradeId, details: { resolution, note: text } });
    const verdict = resolution === "completed" ? "L'échange est considéré comme réglé." : "L'échange est considéré comme échoué.";
    for (const [userId, orderId] of [[r.taker_id, r.taker_order_id], [r.maker_id, r.maker_order_id]] as const) {
      await notify(tx, userId, { kind: "dispute_resolved", title: "Le litige a été tranché", body: `${verdict} ${text}`, link: `/app/ordres/${orderId}#echanges` });
    }
  });
}

// ---------------------------------------------------------------------------
// Invitations et système
// ---------------------------------------------------------------------------

export async function listInvites(sql: Queryable): Promise<{ email: string; note: string | null; invitedAt: Date; registered: boolean }[]> {
  const rows = await sql<{ email: string; note: string | null; invited_at: Date; registered: boolean }[]>`
    select i.email, i.note, i.invited_at, exists (select 1 from auth.users u where lower(u.email) = i.email) as registered
    from public.pilot_invites i order by i.invited_at desc
  `;
  return rows.map((r) => ({ email: r.email, note: r.note, invitedAt: r.invited_at, registered: r.registered }));
}

export async function addInvite(sql: Sql, adminId: string, email: string, note: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new RangeError("Adresse e-mail invalide.");
  await sql.begin(async (tx) => {
    await tx`insert into public.pilot_invites (email, note) values (${normalized}, ${note.trim() || null}) on conflict (email) do nothing`;
    await recordEvent(tx, { actorId: adminId, actorRole: "admin", action: "invite.added", entity: "invite", entityId: normalized });
  });
}

export async function removeInvite(sql: Sql, adminId: string, email: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from public.pilot_invites where email = ${email.trim().toLowerCase()}`;
    await recordEvent(tx, { actorId: adminId, actorRole: "admin", action: "invite.removed", entity: "invite", entityId: email.trim().toLowerCase() });
  });
}

export interface SystemHealth {
  databaseSize: string;
  tables: { name: string; rows: number }[];
  lastEventAt: Date | null;
  failedSignIns24h: number;
  referenceRate: number;
}

export async function getSystemHealth(sql: Queryable): Promise<SystemHealth> {
  const [size] = await sql<{ size: string }[]>`select pg_size_pretty(pg_database_size(current_database())) as size`;
  const tables = await sql<{ name: string; rows: number }[]>`
    select 'orders' as name, count(*)::int as rows from public.orders
    union all select 'trades', count(*)::int from public.trades
    union all select 'settlements', count(*)::int from public.settlements
    union all select 'notifications', count(*)::int from public.notifications
    union all select 'audit_events', count(*)::int from public.audit_events
  `;
  const [last] = await sql<{ at: Date | null }[]>`select max(at) as at from public.audit_events`;
  const [failed] = await sql<{ n: number }[]>`
    select count(*)::int as n from public.audit_events where action = 'user.sign_in_failed' and at > now() - interval '24 hours'
  `;
  return { databaseSize: size.size, tables, lastEventAt: last.at, failedSignIns24h: failed.n, referenceRate: REFERENCE_RATE };
}
