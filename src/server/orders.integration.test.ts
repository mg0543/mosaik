import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { placeOrder, type Order, type Side } from "../lib/matching";
import { createSql } from "./db";
import { cancelOrderForUser, placeOrderForUser } from "./orders";
import { getBookForUser, getMarketSnapshot, getMyOrder, getMyOrders } from "./queries";

// Base Supabase locale (`supabase start`) par défaut. Utilisateurs fictifs, adresses en .test.
const url = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const sql = createSql(url, { max: 10 });
const users = { alice: randomUUID(), bob: randomUUID(), chloe: randomUUID(), dan: randomUUID() };

interface OrderRow {
  id: string;
  owner_id: string;
  side: Side;
  amount: number;
  remaining: number;
  limit_rate: number;
  seq: number;
  status: "open" | "filled" | "cancelled";
  leftover: number;
}

interface TradeRow {
  maker_order_id: string;
  taker_order_id: string;
  eur_cents: number;
  xof: number;
  rate: number;
}

const allOrders = () => sql<OrderRow[]>`select * from public.orders order by seq`;
const allTrades = () => sql<TradeRow[]>`select maker_order_id, taker_order_id, eur_cents, xof, rate from public.trades`;
const order = async (id: string) => (await sql<OrderRow[]>`select * from public.orders where id = ${id}`)[0];

beforeAll(async () => {
  for (const [name, id] of Object.entries(users)) {
    await sql`
      insert into auth.users (id, email, aud, role)
      values (${id}, ${`${name}-${id.slice(0, 8)}@exemple.test`}, 'authenticated', 'authenticated')
    `;
  }
});

beforeEach(async () => {
  await sql`truncate public.trades, public.orders`;
});

afterAll(async () => {
  await sql`truncate public.trades, public.orders`;
  await sql`delete from auth.users where id in ${sql(Object.values(users))}`;
  await sql.end();
});

describe("placeOrderForUser", () => {
  it("enregistre un ordre sans contrepartie comme ouvert", async () => {
    const { orderId, result } = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_XOF", amount: 100_000, limitRate: 600_000,
    });

    expect(result.trades).toHaveLength(0);
    expect(await order(orderId)).toMatchObject({ status: "open", remaining: 100_000, amount: 100_000 });
  });

  it("apparie un ordre entrant au taux de l'ordre inscrit et enregistre l'échange", async () => {
    const resting = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_XOF", amount: 656_000, limitRate: 656_000,
    });
    const incoming = await placeOrderForUser(sql, {
      userId: users.bob, side: "SELL_EUR", amount: 100_000, limitRate: 650_000,
    });

    expect(await allTrades()).toEqual([
      { maker_order_id: resting.orderId, taker_order_id: incoming.orderId, eur_cents: 100_000, xof: 656_000, rate: 656_000 },
    ]);
    expect(await order(resting.orderId)).toMatchObject({ status: "filled", remaining: 0 });
    expect(await order(incoming.orderId)).toMatchObject({ status: "filled", remaining: 0 });
  });

  it("enregistre le reste technique rendu à l'utilisateur", async () => {
    const resting = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 655_000,
    });
    // 65 503 XOF : 100,00 € coûtent 65 500 XOF, les 3 XOF restants ne valent pas 1 centime.
    const incoming = await placeOrderForUser(sql, {
      userId: users.bob, side: "SELL_XOF", amount: 65_503, limitRate: 670_000,
    });

    expect(await order(incoming.orderId)).toMatchObject({ status: "filled", remaining: 0, leftover: 3 });
    expect(await order(resting.orderId)).toMatchObject({ status: "open", remaining: 90_000 });
  });

  it("n'apparie jamais un utilisateur avec lui-même", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 650_000 });
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 100_000, limitRate: 670_000 });

    expect(await allTrades()).toHaveLength(0);
    expect((await allOrders()).map((o) => o.status)).toEqual(["open", "open"]);
  });

  it("refuse un ordre invalide sans rien écrire", async () => {
    await expect(
      placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 5, limitRate: 655_957 }),
    ).rejects.toThrow(/trop faible/);
    expect(await allOrders()).toHaveLength(0);
  });
});

describe("cancelOrderForUser", () => {
  it("annule son propre ordre ouvert, qui n'est plus apparié ensuite", async () => {
    const { orderId } = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 650_000,
    });

    expect(await cancelOrderForUser(sql, users.bob, orderId)).toBe(false); // pas son ordre
    expect(await cancelOrderForUser(sql, users.alice, orderId)).toBe(true);
    expect(await cancelOrderForUser(sql, users.alice, orderId)).toBe(false); // déjà annulé

    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_XOF", amount: 100_000, limitRate: 670_000 });
    expect(await allTrades()).toHaveLength(0);
    expect(await order(orderId)).toMatchObject({ status: "cancelled", remaining: 100_000 });
  });
});

describe("requêtes des écrans", () => {
  it("résume le marché : meilleurs taux et volumes de chaque côté", async () => {
    expect(await getMarketSnapshot(sql)).toEqual({ bestEurOffer: null, eurAvailableCents: 0, bestXofOffer: null, xofAvailable: 0 });

    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 660_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 657_000 });
    await placeOrderForUser(sql, { userId: users.chloe, side: "SELL_XOF", amount: 300_000, limitRate: 650_000 });

    expect(await getMarketSnapshot(sql)).toEqual({
      bestEurOffer: 657_000, eurAvailableCents: 150_000, bestXofOffer: 650_000, xofAvailable: 300_000,
    });
  });

  it("marque les ordres de l'utilisateur dans le carnet sans révéler les autres", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 660_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_XOF", amount: 300_000, limitRate: 650_000 });

    const book = await getBookForUser(sql, users.alice);
    expect(book.map((b) => [b.side, b.isMine])).toEqual([["SELL_EUR", true], ["SELL_XOF", false]]);
    expect(Object.keys(book[0]).sort()).toEqual(["isMine", "limitRate", "remaining", "seq", "side"]);
  });

  it("liste les ordres de l'utilisateur avec ce qu'il a donné et reçu", async () => {
    const resting = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 656_000, limitRate: 656_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });

    const [order] = await getMyOrders(sql, users.alice);
    expect(order).toMatchObject({
      id: resting.orderId, status: "open", amount: 656_000, remaining: 328_000, given: 328_000, received: 50_000, tradeCount: 1,
    });
    expect(await getMyOrders(sql, users.chloe)).toEqual([]);
  });

  it("donne le détail d'un ordre à son seul propriétaire", async () => {
    const resting = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 656_000, limitRate: 656_000 });
    const incoming = await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });

    const mine = await getMyOrder(sql, users.alice, resting.orderId);
    expect(mine?.trades).toEqual([expect.objectContaining({ eurCents: 50_000, xof: 328_000, rate: 656_000, role: "maker" })]);
    expect((await getMyOrder(sql, users.bob, incoming.orderId))?.trades[0].role).toBe("taker");

    // Les échanges d'une même transaction sont listés dans l'ordre d'exécution du moteur.
    await placeOrderForUser(sql, { userId: users.chloe, side: "SELL_EUR", amount: 40_000, limitRate: 658_000 });
    await placeOrderForUser(sql, { userId: users.dan, side: "SELL_EUR", amount: 80_000, limitRate: 656_000 });
    const sweep = await placeOrderForUser(sql, { userId: users.bob, side: "SELL_XOF", amount: 1_000_000, limitRate: 670_000 });
    const sweepTrades = (await getMyOrder(sql, users.bob, sweep.orderId))?.trades ?? [];
    expect(sweepTrades.map((t) => t.rate)).toEqual(sweep.result.trades.map((t) => t.rate));
    expect(sweepTrades.map((t) => t.rate)).toEqual([656_000, 658_000]);

    // Jamais l'ordre d'un autre, même avec son identifiant ; un identifiant mal formé ne casse rien.
    expect(await getMyOrder(sql, users.bob, resting.orderId)).toBeNull();
    expect(await getMyOrder(sql, users.alice, "pas-un-uuid")).toBeNull();
  });
});

describe("sécurité de la base (RLS)", () => {
  /** Exécute une requête comme le ferait le navigateur d'un utilisateur connecté. */
  async function asUser<T>(userId: string, query: (tx: typeof sql) => Promise<T>): Promise<T> {
    return sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
      await tx`set local role authenticated`;
      return query(tx as unknown as typeof sql);
    }) as Promise<T>;
  }

  it("ne montre à un utilisateur que ses propres ordres et échanges", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 656_000, limitRate: 656_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });
    await placeOrderForUser(sql, { userId: users.chloe, side: "SELL_EUR", amount: 50_000, limitRate: 700_000 });

    const aliceOrders = await asUser(users.alice, (tx) => tx`select owner_id from public.orders`);
    expect(aliceOrders.map((o) => o.owner_id)).toEqual([users.alice]);
    const bobTrades = await asUser(users.bob, (tx) => tx`select taker_id from public.trades`);
    expect(bobTrades).toHaveLength(1);
    const chloeTrades = await asUser(users.chloe, (tx) => tx`select * from public.trades`);
    expect(chloeTrades).toHaveLength(0);
  });

  it("interdit toute écriture directe depuis un client", async () => {
    await expect(
      asUser(users.alice, (tx) => tx`
        insert into public.orders (owner_id, side, amount, remaining, limit_rate)
        values (${users.alice}, 'SELL_EUR', 100, 100, 655957)
      `),
    ).rejects.toThrow();

    const { orderId } = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 650_000,
    });
    await expect(
      asUser(users.alice, (tx) => tx`update public.orders set remaining = 1 where id = ${orderId}`),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(users.alice, (tx) => tx`truncate public.trades, public.orders`)).rejects.toThrow(
      /permission denied/,
    );
    expect(await order(orderId)).toMatchObject({ remaining: 100_000 });
  });

  it("ne donne aux visiteurs non connectés que le carnet anonymisé", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 660_000 });
    const asAnon = <T,>(query: (tx: typeof sql) => Promise<T>) =>
      sql.begin(async (tx) => {
        await tx`set local role anon`;
        return query(tx as unknown as typeof sql);
      });

    await expect(asAnon((tx) => tx`select * from public.orders`)).rejects.toThrow(/permission denied/);
    await expect(asAnon((tx) => tx`select * from public.trades`)).rejects.toThrow(/permission denied/);
    const book = await asAnon((tx) => tx`select * from public.order_book()`);
    expect(Object.keys(book[0]).sort()).toEqual(["limit_rate", "remaining", "seq", "side"]);
  });

  it("expose un carnet public anonymisé", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 100_000, limitRate: 660_000 });

    const book = await asUser(users.bob, (tx) => tx`select * from public.order_book()`);
    expect(book).toEqual([expect.objectContaining({ side: "SELL_EUR", remaining: 100_000, limit_rate: 660_000 })]);
    expect(Object.keys(book[0]).sort()).toEqual(["limit_rate", "remaining", "seq", "side"]);
  });
});

describe("concurrence", () => {
  it("reste exact quand de nombreux ordres arrivent en même temps", async () => {
    // Générateur pseudo-aléatoire à graine fixe : le test est reproductible.
    let state = 20261020;
    const random = () => (state = (state * 1_103_515_245 + 12_345) % 2_147_483_648) / 2_147_483_648;
    const owners = Object.values(users);

    const inputs = Array.from({ length: 60 }, () => {
      const side: Side = random() < 0.5 ? "SELL_EUR" : "SELL_XOF";
      return {
        userId: owners[Math.floor(random() * owners.length)],
        side,
        amount: side === "SELL_EUR" ? 1_000 + Math.floor(random() * 200_000) : 10_000 + Math.floor(random() * 1_500_000),
        limitRate: 645_000 + Math.floor(random() * 20_000),
      };
    });

    await Promise.all(inputs.map((input) => placeOrderForUser(sql, input)));

    const orders = await allOrders();
    const trades = await allTrades();
    expect(orders).toHaveLength(60);
    expect(trades.length).toBeGreaterThan(0);

    // 1. Conservation : pour chaque ordre, montant = reste + échangé + reste technique.
    for (const o of orders) {
      const exchanged = trades
        .filter((t) => t.maker_order_id === o.id || t.taker_order_id === o.id)
        .reduce((s, t) => s + (o.side === "SELL_EUR" ? t.eur_cents : t.xof), 0);
      expect(o.remaining + exchanged + o.leftover).toBe(o.amount);
    }

    // 2. Aucun croisement possible ne subsiste entre deux utilisateurs différents.
    const open = orders.filter((o) => o.status === "open");
    for (const e of open.filter((o) => o.side === "SELL_EUR")) {
      for (const x of open.filter((o) => o.side === "SELL_XOF" && o.owner_id !== e.owner_id)) {
        expect(e.limit_rate).toBeGreaterThan(x.limit_rate);
      }
    }

    // 3. La base donne exactement le résultat du moteur pur rejoué dans l'ordre d'arrivée.
    let book: Order[] = [];
    const replayTrades: TradeRow[] = [];
    for (const o of orders) {
      const result = placeOrder(book, {
        id: o.id, ownerId: o.owner_id, side: o.side, remaining: o.amount, limitRate: o.limit_rate, seq: o.seq,
      });
      book = result.book;
      replayTrades.push(
        ...result.trades.map((t) => ({
          maker_order_id: t.makerOrderId, taker_order_id: t.takerOrderId, eur_cents: t.eurCents, xof: t.xof, rate: t.rate,
        })),
      );
    }
    const key = (t: TradeRow) => `${t.maker_order_id}/${t.taker_order_id}/${t.eur_cents}/${t.xof}/${t.rate}`;
    expect(trades.map(key).sort()).toEqual(replayTrades.map(key).sort());
    const replayRemaining = new Map(book.map((o) => [o.id, o.remaining]));
    for (const o of orders) expect(o.remaining).toBe(replayRemaining.get(o.id) ?? 0);
  });
});
