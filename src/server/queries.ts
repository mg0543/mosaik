import type { RateMilli, Side } from "../lib/matching";
import type { Sql } from "./db";

/**
 * Lectures pour les écrans. La connexion serveur contourne la RLS : chaque requête qui
 * concerne un utilisateur filtre donc explicitement sur son identifiant (issu de la session).
 */

export interface MarketSnapshot {
  /** Meilleur prix pour acheter des EUR : le plus petit taux minimum des vendeurs d'EUR. */
  bestEurOffer: RateMilli | null;
  eurAvailableCents: number;
  /** Meilleur prix pour acheter des XOF : le plus grand taux maximum des vendeurs de XOF. */
  bestXofOffer: RateMilli | null;
  xofAvailable: number;
}

export async function getMarketSnapshot(sql: Sql): Promise<MarketSnapshot> {
  const rows = await sql<{ side: Side; best_low: number; best_high: number; total: number }[]>`
    select side, min(limit_rate) as best_low, max(limit_rate) as best_high, sum(remaining)::bigint as total
    from public.orders where status = 'open'
    group by side
  `;
  const eur = rows.find((r) => r.side === "SELL_EUR");
  const xof = rows.find((r) => r.side === "SELL_XOF");
  return {
    bestEurOffer: eur?.best_low ?? null,
    eurAvailableCents: eur?.total ?? 0,
    bestXofOffer: xof?.best_high ?? null,
    xofAvailable: xof?.total ?? 0,
  };
}

/** Ligne du carnet anonymisé, avec l'indication « c'est le mien » pour l'aperçu. */
export interface BookEntry {
  side: Side;
  remaining: number;
  limitRate: RateMilli;
  seq: number;
  isMine: boolean;
}

export async function getBookForUser(sql: Sql, userId: string): Promise<BookEntry[]> {
  const rows = await sql<{ side: Side; remaining: number; limit_rate: number; seq: number; is_mine: boolean }[]>`
    select side, remaining, limit_rate, seq, owner_id = ${userId} as is_mine
    from public.orders where status = 'open'
    order by seq
  `;
  return rows.map((r) => ({ side: r.side, remaining: r.remaining, limitRate: r.limit_rate, seq: r.seq, isMine: r.is_mine }));
}

export type OrderStatus = "open" | "filled" | "cancelled";

export interface MyOrder {
  id: string;
  side: Side;
  amount: number;
  remaining: number;
  limitRate: RateMilli;
  status: OrderStatus;
  leftover: number;
  createdAt: Date;
  /** Total donné (devise de l'ordre) et reçu (devise opposée) à travers les échanges. */
  given: number;
  received: number;
  tradeCount: number;
}

interface MyOrderRow {
  id: string;
  side: Side;
  amount: number;
  remaining: number;
  limit_rate: number;
  status: OrderStatus;
  leftover: number;
  created_at: Date;
  eur_total: number;
  xof_total: number;
  trade_count: number;
}

const toMyOrder = (r: MyOrderRow): MyOrder => ({
  id: r.id,
  side: r.side,
  amount: r.amount,
  remaining: r.remaining,
  limitRate: r.limit_rate,
  status: r.status,
  leftover: r.leftover,
  createdAt: r.created_at,
  given: r.side === "SELL_EUR" ? r.eur_total : r.xof_total,
  received: r.side === "SELL_EUR" ? r.xof_total : r.eur_total,
  tradeCount: r.trade_count,
});

export async function getMyOrders(sql: Sql, userId: string, limit = 50): Promise<MyOrder[]> {
  return selectMyOrders(sql, userId, { limit });
}

/** Ordres de l'utilisateur avec les totaux de leurs échanges ; filtre optionnel sur un ordre. */
async function selectMyOrders(
  sql: Sql,
  userId: string,
  { limit, orderId }: { limit: number; orderId?: string },
): Promise<MyOrder[]> {
  const rows = await sql<MyOrderRow[]>`
    select o.id, o.side, o.amount, o.remaining, o.limit_rate, o.status, o.leftover, o.created_at,
           coalesce(t.eur_total, 0)::bigint as eur_total, coalesce(t.xof_total, 0)::bigint as xof_total,
           coalesce(t.trade_count, 0)::int as trade_count
    from public.orders o
    left join lateral (
      select sum(eur_cents) as eur_total, sum(xof) as xof_total, count(*) as trade_count
      from public.trades where maker_order_id = o.id or taker_order_id = o.id
    ) t on true
    where o.owner_id = ${userId} ${orderId ? sql`and o.id = ${orderId}` : sql``}
    order by o.created_at desc, o.seq desc
    limit ${limit}
  `;
  return rows.map(toMyOrder);
}

export interface OrderTrade {
  id: string;
  eurCents: number;
  xof: number;
  rate: RateMilli;
  createdAt: Date;
  /** « maker » : votre ordre attendait dans le carnet ; « taker » : votre ordre est arrivé. */
  role: "maker" | "taker";
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un ordre de l'utilisateur et ses échanges, ou null s'il n'existe pas ou n'est pas à lui. */
export async function getMyOrder(
  sql: Sql,
  userId: string,
  orderId: string,
): Promise<{ order: MyOrder; trades: OrderTrade[] } | null> {
  if (!UUID.test(orderId)) return null;
  const orders = await selectMyOrders(sql, userId, { limit: 1, orderId });
  if (orders.length === 0) return null;
  const trades = await sql<{ id: string; eur_cents: number; xof: number; rate: number; created_at: Date; role: "maker" | "taker" }[]>`
    select id, eur_cents, xof, rate, created_at,
           case when maker_order_id = ${orderId} then 'maker' else 'taker' end as role
    from public.trades
    where maker_order_id = ${orderId} or taker_order_id = ${orderId}
    order by seq
  `;
  return {
    order: orders[0],
    trades: trades.map((t) => ({ id: t.id, eurCents: t.eur_cents, xof: t.xof, rate: t.rate, createdAt: t.created_at, role: t.role })),
  };
}
