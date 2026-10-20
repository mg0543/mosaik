import { assertValidOrder, placeOrder, type Order, type PlaceOrderResult, type Side } from "../lib/matching";
import type { Sql } from "./db";

/**
 * Clé du verrou consultatif qui protège le carnet. Chaque passage ou annulation d'ordre
 * le prend pour la durée de sa transaction : les appariements s'exécutent donc l'un après
 * l'autre, et deux ordres ne peuvent jamais consommer la même contrepartie.
 * Le débit reste largement suffisant pour un pilote ; un verrouillage plus fin ne se
 * justifiera qu'avec un volume bien supérieur.
 */
const ORDER_BOOK_LOCK = 7_402_113;

export interface NewOrderInput {
  userId: string;
  side: Side;
  /** Centimes (SELL_EUR) ou XOF (SELL_XOF). */
  amount: number;
  /** Millièmes de XOF par EUR. */
  limitRate: number;
}

export interface PlacedOrder {
  orderId: string;
  seq: number;
  result: PlaceOrderResult;
}

interface OrderRow {
  id: string;
  owner_id: string;
  side: Side;
  remaining: number;
  limit_rate: number;
  seq: number;
}

const toOrder = (row: OrderRow): Order => ({
  id: row.id,
  ownerId: row.owner_id,
  side: row.side,
  remaining: row.remaining,
  limitRate: row.limit_rate,
  seq: row.seq,
});

/**
 * Enregistre un ordre et l'apparie avec le carnet, dans une seule transaction.
 * Le calcul est fait par le moteur pur (placeOrder) ; cette fonction ne fait que charger
 * les contreparties, appeler le moteur et écrire son résultat.
 */
export async function placeOrderForUser(sql: Sql, input: NewOrderInput): Promise<PlacedOrder> {
  const { userId, side, amount, limitRate } = input;
  // Validation avant toute écriture : mêmes règles que le moteur.
  assertValidOrder({ id: "nouvel-ordre", ownerId: userId, side, remaining: amount, limitRate, seq: 0 });

  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${ORDER_BOOK_LOCK})`;

    const [created] = await tx<{ id: string; seq: number }[]>`
      insert into public.orders (owner_id, side, amount, remaining, limit_rate)
      values (${userId}, ${side}, ${amount}, ${amount}, ${limitRate})
      returning id, seq
    `;

    // Contreparties compatibles, hors ordres du même utilisateur.
    const makers =
      side === "SELL_XOF"
        ? await tx<OrderRow[]>`
            select id, owner_id, side, remaining, limit_rate, seq from public.orders
            where status = 'open' and side = 'SELL_EUR' and owner_id <> ${userId} and limit_rate <= ${limitRate}
            order by limit_rate, seq
          `
        : await tx<OrderRow[]>`
            select id, owner_id, side, remaining, limit_rate, seq from public.orders
            where status = 'open' and side = 'SELL_XOF' and owner_id <> ${userId} and limit_rate >= ${limitRate}
            order by limit_rate desc, seq
          `;

    const taker: Order = { id: created.id, ownerId: userId, side, remaining: amount, limitRate, seq: created.seq };
    const result = placeOrder(makers.map(toOrder), taker);

    if (result.trades.length > 0) {
      await tx`
        insert into public.trades ${tx(
          result.trades.map((t) => ({
            maker_order_id: t.makerOrderId,
            taker_order_id: t.takerOrderId,
            maker_id: t.makerId,
            taker_id: t.takerId,
            eur_cents: t.eurCents,
            xof: t.xof,
            rate: t.rate,
          })),
        )}
      `;
    }

    // Mise à jour des contreparties touchées et de l'ordre entrant.
    const remainingAfter = new Map(result.book.map((o) => [o.id, o.remaining]));
    const leftoverOf = new Map(result.closed.map((c) => [c.orderId, c.amount]));
    const touched = new Set([...result.trades.map((t) => t.makerOrderId), created.id]);

    for (const id of touched) {
      const remaining = remainingAfter.get(id) ?? 0;
      const leftover = leftoverOf.get(id) ?? 0;
      await tx`
        update public.orders
        set remaining = ${remaining},
            leftover = leftover + ${leftover},
            status = ${remaining > 0 ? "open" : "filled"}
        where id = ${id}
      `;
    }

    return { orderId: created.id, seq: created.seq, result };
  });
}

/**
 * Annule un ordre ouvert appartenant à l'utilisateur. Le reste non échangé lui revient.
 * Renvoie false si l'ordre n'existe pas, n'est pas à lui ou n'est plus ouvert.
 */
export async function cancelOrderForUser(sql: Sql, userId: string, orderId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(${ORDER_BOOK_LOCK})`;
    const rows = await tx`
      update public.orders set status = 'cancelled'
      where id = ${orderId} and owner_id = ${userId} and status = 'open'
      returning id
    `;
    return rows.length === 1;
  });
}
