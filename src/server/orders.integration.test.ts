import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { placeOrder, type Order, type Side } from "../lib/matching";
import { createSql } from "./db";
import { cancelOrderForUser, getVolumeUsage, placeOrderForUser } from "./orders";
import { getBookForUser, getMarketSnapshot, getMyOrder, getMyOrders, getPublicBook } from "./queries";
import { canSignIn, inviteToPilot } from "./invites";
import { getProfile } from "./profiles";
import { confirmSettlementStep, getPendingActions, openDispute, saveEurDetails, saveXofDetails } from "./settlements";

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

// Coordonnées fictives : IBAN d'exemple publié, numéros sans abonné réel.
const EXAMPLE_IBAN = "FR7630006000011234567890189";

beforeAll(async () => {
  let n = 1;
  for (const [name, id] of Object.entries(users)) {
    await sql`
      insert into auth.users (id, email, aud, role)
      values (${id}, ${`${name}-${id.slice(0, 8)}@exemple.test`}, 'authenticated', 'authenticated')
    `;
    await saveEurDetails(sql, id, { iban: EXAMPLE_IBAN, holder: `Test ${name}` });
    await saveXofDetails(sql, id, { operator: "wave", phone: `+22177000000${n++}`, holder: `Test ${name}` });
  }
});

beforeEach(async () => {
  await sql`truncate public.settlements, public.trades, public.orders`;
});

afterAll(async () => {
  await sql`truncate public.settlements, public.trades, public.orders`;
  await sql`delete from public.payment_details where user_id in ${sql(Object.values(users))}`;
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
      userId: users.alice, side: "SELL_XOF", amount: 328_000, limitRate: 656_000,
    });
    const incoming = await placeOrderForUser(sql, {
      userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000,
    });

    expect(await allTrades()).toEqual([
      { maker_order_id: resting.orderId, taker_order_id: incoming.orderId, eur_cents: 50_000, xof: 328_000, rate: 656_000 },
    ]);
    expect(await order(resting.orderId)).toMatchObject({ status: "filled", remaining: 0 });
    expect(await order(incoming.orderId)).toMatchObject({ status: "filled", remaining: 0 });
  });

  it("enregistre le reste technique rendu à l'utilisateur", async () => {
    const resting = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 655_000,
    });
    // 65 503 XOF : 100,00 € coûtent 65 500 XOF, les 3 XOF restants ne valent pas 1 centime.
    const incoming = await placeOrderForUser(sql, {
      userId: users.bob, side: "SELL_XOF", amount: 65_503, limitRate: 670_000,
    });

    expect(await order(incoming.orderId)).toMatchObject({ status: "filled", remaining: 0, leftover: 3 });
    expect(await order(resting.orderId)).toMatchObject({ status: "open", remaining: 40_000 });
  });

  it("n'apparie jamais un utilisateur avec lui-même", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });
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

describe("limites d'activité", () => {
  it("refuse un ordre de plus quand l'utilisateur a déjà 10 ordres en attente", async () => {
    for (let i = 0; i < 10; i++) {
      await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 10_000, limitRate: 700_000 });
    }
    await expect(
      placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 10_000, limitRate: 700_000 }),
    ).rejects.toThrow(/10 demandes en attente/);
    // Les autres utilisateurs ne sont pas concernés.
    await expect(
      placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 10_000, limitRate: 700_000 }),
    ).resolves.toBeDefined();
  });

  it("tient sous une rafale d'envois simultanés : exactement 10 ordres acceptés", async () => {
    const burst = await Promise.allSettled(
      Array.from({ length: 15 }, () =>
        placeOrderForUser(sql, { userId: users.chloe, side: "SELL_XOF", amount: 100_000, limitRate: 600_000 }),
      ),
    );
    expect(burst.filter((o) => o.status === "fulfilled")).toHaveLength(10);
    expect((await allOrders()).filter((o) => o.owner_id === users.chloe)).toHaveLength(10);
  });

  it("applique aussi les garde-fous de montant et de taux côté service", async () => {
    await expect(
      placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 100_000, limitRate: 6_559_000 }),
    ).rejects.toThrow(/Taux hors limites/);
    await expect(
      placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 2_000_001, limitRate: 655_957 }),
    ).rejects.toThrow(/Montant trop élevé/);
    expect(await allOrders()).toHaveLength(0);
  });
});

describe("intégrité imposée par la base", () => {
  /** Un ordre servi en partie par un échange : la matière de tous les cas ci-dessous. */
  async function partiallyFilled() {
    const resting = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 492_000, limitRate: 656_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });
    return resting.orderId;
  }

  it("interdit de modifier ou supprimer un échange conclu", async () => {
    await partiallyFilled();
    await expect(sql`update public.trades set xof = xof + 1`).rejects.toThrow(/ni modifiés ni supprimés/);
    await expect(sql`delete from public.trades`).rejects.toThrow(/ni modifiés ni supprimés/);
    expect(await allTrades()).toHaveLength(1);
  });

  it("interdit de changer les caractéristiques d'un ordre", async () => {
    const id = await partiallyFilled();
    await expect(sql`update public.orders set amount = amount + 1 where id = ${id}`).rejects.toThrow(/caractéristiques/);
    await expect(sql`update public.orders set limit_rate = 700000 where id = ${id}`).rejects.toThrow(/caractéristiques/);
    await expect(sql`update public.orders set owner_id = ${users.bob} where id = ${id}`).rejects.toThrow(/caractéristiques/);
  });

  it("interdit d'augmenter le reste ou de supprimer un ordre", async () => {
    const id = await partiallyFilled();
    await expect(sql`update public.orders set remaining = remaining + 1 where id = ${id}`).rejects.toThrow(/que diminuer/);
    await expect(sql`delete from public.orders where id = ${id}`).rejects.toThrow(/annulé/);
  });

  it("garde terminés les ordres servis ou annulés", async () => {
    const id = await partiallyFilled();
    expect(await cancelOrderForUser(sql, users.alice, id)).toBe(true);
    await expect(sql`update public.orders set status = 'open' where id = ${id}`).rejects.toThrow(/ne peut plus être modifié/);
    const [filled] = await sql<{ id: string }[]>`select id from public.orders where status = 'filled'`;
    await expect(sql`update public.orders set status = 'open', remaining = 1 where id = ${filled.id}`).rejects.toThrow(
      /ne peut plus être modifié/,
    );
  });

  it("refuse un ordre dont le reste et le reste technique dépasseraient le montant", async () => {
    const id = await partiallyFilled();
    await expect(sql`update public.orders set leftover = amount where id = ${id}`).rejects.toThrow(/orders_accounting/);
  });
});

describe("règlement entre participants", () => {
  interface SettlementRow {
    trade_id: string;
    taker_id: string;
    maker_id: string;
    taker_currency: string;
    taker_amount: number;
    taker_pays_to: unknown;
    maker_amount: number;
    maker_pays_to: unknown;
    due_at: Date;
    created_at: Date;
    disputed_at: Date | null;
  }
  const settlements = () => sql<SettlementRow[]>`select * from public.settlements`;

  /** Alice attend avec 328 000 XOF à 656 ; Bob arrive et vend 500 € : il est le preneur. */
  async function aliceAndBobTrade() {
    const alice = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 328_000, limitRate: 656_000 });
    const bob = await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });
    const [s] = await settlements();
    return { aliceOrder: alice.orderId, bobOrder: bob.orderId, tradeId: s.trade_id };
  }

  it("crée un règlement par échange, avec les coordonnées de chacun figées", async () => {
    await aliceAndBobTrade();
    const [s] = await settlements();
    expect(s).toMatchObject({
      taker_id: users.bob,
      maker_id: users.alice,
      // Bob, preneur, envoie d'abord ses 500 € sur l'IBAN d'Alice…
      taker_currency: "EUR",
      taker_amount: 50_000,
      taker_pays_to: { method: "iban", account: EXAMPLE_IBAN, holder: "Test alice" },
      // … puis Alice envoie 328 000 XOF sur le Wave de Bob.
      maker_amount: 328_000,
      maker_pays_to: { method: "wave", account: "+221770000002", holder: "Test bob" },
    });
    expect(s.due_at.getTime() - s.created_at.getTime()).toBe(24 * 3600 * 1000);
  });

  it("montre à chacun ce qu'il doit envoyer, où, et ce qu'il doit recevoir", async () => {
    const { aliceOrder, bobOrder } = await aliceAndBobTrade();
    const bobView = (await getMyOrder(sql, users.bob, bobOrder))!.trades[0].settlement!;
    expect(bobView.youSend).toEqual({
      currency: "EUR", amount: 50_000, payTo: { method: "iban", account: EXAMPLE_IBAN, holder: "Test alice" },
    });
    expect(bobView.youReceive).toEqual({ currency: "XOF", amount: 328_000 });

    const aliceView = (await getMyOrder(sql, users.alice, aliceOrder))!.trades[0].settlement!;
    expect(aliceView.youSend).toEqual({
      currency: "XOF", amount: 328_000, payTo: { method: "wave", account: "+221770000002", holder: "Test bob" },
    });
    expect(aliceView.youReceive).toEqual({ currency: "EUR", amount: 50_000 });
    expect(aliceView.takerSentAt).toBeNull();
  });

  it("garde les coordonnées figées même si le participant les modifie ensuite", async () => {
    await aliceAndBobTrade();
    await saveEurDetails(sql, users.alice, { iban: "BE68539007547034", holder: "Autre nom" });
    const [s] = await settlements();
    expect(s.taker_pays_to).toMatchObject({ account: EXAMPLE_IBAN, holder: "Test alice" });
    await saveEurDetails(sql, users.alice, { iban: EXAMPLE_IBAN, holder: "Test alice" });
  });

  it("refuse un ordre tant que la coordonnée pour recevoir manque", async () => {
    const eve = randomUUID();
    await sql`insert into auth.users (id, email, aud, role) values (${eve}, ${`eve-${eve.slice(0, 8)}@exemple.test`}, 'authenticated', 'authenticated')`;
    try {
      await expect(
        placeOrderForUser(sql, { userId: eve, side: "SELL_XOF", amount: 100_000, limitRate: 660_000 }),
      ).rejects.toThrow(/coordonnées pour recevoir des euros/);
      await saveXofDetails(sql, eve, { operator: "orange_money", phone: "+225 07 00 00 00 99", holder: "Test eve" });
      // Avec un numéro mobile money, elle peut recevoir des XOF mais toujours pas des euros.
      await expect(
        placeOrderForUser(sql, { userId: eve, side: "SELL_XOF", amount: 100_000, limitRate: 660_000 }),
      ).rejects.toThrow(/euros/);
      expect(await allOrders()).toHaveLength(0);
    } finally {
      await sql`delete from public.payment_details where user_id = ${eve}`;
      await sql`delete from auth.users where id = ${eve}`;
    }
  });

  it("impose l'ordre des étapes et le bon participant à chaque étape", async () => {
    const { tradeId } = await aliceAndBobTrade();
    // Personne ne peut sauter l'envoi du preneur, ni agir à sa place.
    expect(await confirmSettlementStep(sql, users.alice, tradeId, "maker_received")).toBe(false);
    expect(await confirmSettlementStep(sql, users.alice, tradeId, "taker_sent")).toBe(false);
    expect(await confirmSettlementStep(sql, users.chloe, tradeId, "taker_sent")).toBe(false);

    expect(await confirmSettlementStep(sql, users.bob, tradeId, "taker_sent")).toBe(true);
    expect(await confirmSettlementStep(sql, users.bob, tradeId, "taker_sent")).toBe(false); // déjà fait
    expect(await confirmSettlementStep(sql, users.bob, tradeId, "maker_received")).toBe(false);
    expect(await confirmSettlementStep(sql, users.alice, tradeId, "maker_sent")).toBe(false); // réception d'abord
    expect(await confirmSettlementStep(sql, users.alice, tradeId, "maker_received")).toBe(true);
    expect(await confirmSettlementStep(sql, users.alice, tradeId, "maker_sent")).toBe(true);
    expect(await confirmSettlementStep(sql, users.bob, tradeId, "taker_received")).toBe(true);

    expect(await getPendingActions(sql, users.alice)).toEqual([]);
    expect(await getPendingActions(sql, users.bob)).toEqual([]);
    expect(await confirmSettlementStep(sql, users.bob, "pas-un-uuid", "taker_sent")).toBe(false);
  });

  it("indique à chacun ce qu'il doit faire, avec son propre ordre", async () => {
    const { aliceOrder, bobOrder, tradeId } = await aliceAndBobTrade();
    expect(await getPendingActions(sql, users.bob)).toEqual([expect.objectContaining({ tradeId, orderId: bobOrder, step: "taker_sent" })]);
    expect(await getPendingActions(sql, users.alice)).toEqual([]);

    await confirmSettlementStep(sql, users.bob, tradeId, "taker_sent");
    expect(await getPendingActions(sql, users.bob)).toEqual([]);
    expect(await getPendingActions(sql, users.alice)).toEqual([
      expect.objectContaining({ tradeId, orderId: aliceOrder, step: "maker_received" }),
    ]);
  });

  it("gèle le règlement dès qu'un litige est signalé", async () => {
    const { tradeId } = await aliceAndBobTrade();
    await confirmSettlementStep(sql, users.bob, tradeId, "taker_sent");

    await expect(openDispute(sql, users.alice, tradeId, "rien")).rejects.toThrow(/5 à 500/);
    expect(await openDispute(sql, users.chloe, tradeId, "Je ne suis pas concernée")).toBe(false);
    expect(await openDispute(sql, users.alice, tradeId, "Je n'ai rien reçu sur mon compte")).toBe(true);
    expect(await openDispute(sql, users.bob, tradeId, "Second signalement")).toBe(false);

    expect(await confirmSettlementStep(sql, users.alice, tradeId, "maker_received")).toBe(false);
    expect(await getPendingActions(sql, users.alice)).toEqual([]);
    await expect(sql`update public.settlements set maker_received_at = now()`).rejects.toThrow(/gelé/);
  });

  it("ne permet plus de litige une fois le règlement terminé", async () => {
    const { tradeId } = await aliceAndBobTrade();
    await confirmSettlementStep(sql, users.bob, tradeId, "taker_sent");
    await confirmSettlementStep(sql, users.alice, tradeId, "maker_received");
    await confirmSettlementStep(sql, users.alice, tradeId, "maker_sent");
    await confirmSettlementStep(sql, users.bob, tradeId, "taker_received");
    expect(await openDispute(sql, users.alice, tradeId, "Trop tard pour contester")).toBe(false);
  });

  it("protège les règlements dans la base : coordonnées figées, étapes définitives, pas de suppression", async () => {
    const { tradeId } = await aliceAndBobTrade();
    await confirmSettlementStep(sql, users.bob, tradeId, "taker_sent");
    await expect(sql`update public.settlements set taker_pays_to = '{"method":"iban"}'`).rejects.toThrow(/caractéristiques/);
    await expect(sql`update public.settlements set taker_sent_at = null`).rejects.toThrow(/ne peut pas être annulée/);
    await expect(sql`delete from public.settlements`).rejects.toThrow(/supprimé/);
    await expect(sql`update public.settlements set maker_sent_at = now()`).rejects.toThrow(/settlements_sequence/);
  });
});

describe("profils", () => {
  it("crée le profil avec le compte, à partir des informations d'inscription", async () => {
    const id = randomUUID();
    const meta = { first_name: " Aïssatou ", last_name: "N'Diaye", phone: "+221771234567" };
    try {
      await sql`
        insert into auth.users (id, email, aud, role, raw_user_meta_data)
        values (${id}, ${`profil-${id.slice(0, 8)}@exemple.test`}, 'authenticated', 'authenticated', ${sql.json(meta)})
      `;
      expect(await getProfile(sql, id)).toEqual({ firstName: "Aïssatou", lastName: "N'Diaye", phone: "+221771234567" });
    } finally {
      await sql`delete from auth.users where id = ${id}`;
    }
    // Le profil disparaît avec le compte.
    expect(await getProfile(sql, id)).toEqual({ firstName: null, lastName: null, phone: null });
  });

  it("refuse tout le compte si les informations sont invalides", async () => {
    const id = randomUUID();
    await expect(sql`
      insert into auth.users (id, email, aud, role, raw_user_meta_data)
      values (${id}, ${`profil-${id.slice(0, 8)}@exemple.test`}, 'authenticated', 'authenticated',
              ${sql.json({ first_name: "Awa", last_name: "Diop", phone: "0612345678" })})
    `).rejects.toThrow(/profiles_phone_check/);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from auth.users where id = ${id}`;
    expect(n).toBe(0);
  });

  it("ne laisse lire que son propre profil, sans aucune écriture côté client", async () => {
    const asUser = (userId: string, query: (tx: typeof sql) => Promise<unknown>) =>
      sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
        await tx`set local role authenticated`;
        return query(tx as unknown as typeof sql);
      });
    const rows = (await asUser(users.alice, (tx) => tx`select user_id from public.profiles`)) as { user_id: string }[];
    expect(rows.map((r) => r.user_id)).toEqual([users.alice]);
    await expect(asUser(users.alice, (tx) => tx`update public.profiles set first_name = 'Pirate'`)).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("pilote sur invitation", () => {
  it("n'ouvre la connexion qu'aux adresses invitées ou déjà inscrites", async () => {
    const stranger = `inconnu-${randomUUID().slice(0, 8)}@exemple.test`;
    expect(await canSignIn(sql, stranger)).toBe(false);

    await inviteToPilot(sql, `  ${stranger.toUpperCase()} `, "test");
    expect(await canSignIn(sql, stranger)).toBe(true);
    await inviteToPilot(sql, stranger); // une seconde invitation ne change rien
    await sql`delete from public.pilot_invites where email = ${stranger}`;

    // Un compte existant garde l'accès, quelle que soit la casse saisie.
    const [alice] = await sql<{ email: string }[]>`select email from auth.users where id = ${users.alice}`;
    expect(await canSignIn(sql, alice.email.toUpperCase())).toBe(true);
  });
});

describe("plafonds journalier et mensuel", () => {
  it("refuse ce qui dépasse le plafond du jour, et libère la part non échangée d'une demande annulée", async () => {
    const first = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 1_500_000, limitRate: 600_000 });
    await expect(
      placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 600_000, limitRate: 600_000 }),
    ).rejects.toThrow(/dépasse votre plafond journalier.*il vous reste 500\s000 XOF aujourd'hui/);

    // Annulée sans avoir été servie, la première demande ne compte plus.
    await cancelOrderForUser(sql, users.alice, first.orderId);
    await expect(
      placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 600_000, limitRate: 600_000 }),
    ).resolves.toBeDefined();
  });

  it("compte les euros au taux officiel, et ignore les mois précédents", async () => {
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 100_000, limitRate: 700_000 }); // 1 000 €
    await sql`
      insert into public.orders (owner_id, side, amount, remaining, limit_rate, status, created_at)
      values (${users.bob}, 'SELL_XOF', 1500000, 0, 655957, 'filled',
              date_trunc('month', now() at time zone 'UTC') at time zone 'UTC' - interval '1 day')
    `;
    expect(await getVolumeUsage(sql, users.bob)).toEqual({ today: 655_957, month: 655_957 });
  });
});

describe("cancelOrderForUser", () => {
  it("annule son propre ordre ouvert, qui n'est plus apparié ensuite", async () => {
    const { orderId } = await placeOrderForUser(sql, {
      userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 650_000,
    });

    expect(await cancelOrderForUser(sql, users.bob, orderId)).toBe(false); // pas son ordre
    expect(await cancelOrderForUser(sql, users.alice, orderId)).toBe(true);
    expect(await cancelOrderForUser(sql, users.alice, orderId)).toBe(false); // déjà annulé

    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_XOF", amount: 100_000, limitRate: 670_000 });
    expect(await allTrades()).toHaveLength(0);
    expect(await order(orderId)).toMatchObject({ status: "cancelled", remaining: 50_000 });
  });
});

describe("requêtes des écrans", () => {
  it("résume le marché : meilleurs taux et volumes de chaque côté", async () => {
    expect(await getMarketSnapshot(sql)).toEqual({ bestEurOffer: null, eurAvailableCents: 0, bestXofOffer: null, xofAvailable: 0 });

    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 660_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 657_000 });
    await placeOrderForUser(sql, { userId: users.chloe, side: "SELL_XOF", amount: 300_000, limitRate: 650_000 });

    expect(await getMarketSnapshot(sql)).toEqual({
      bestEurOffer: 657_000, eurAvailableCents: 100_000, bestXofOffer: 650_000, xofAvailable: 300_000,
    });
    // Vu par Bob, sa propre offre n'apparaît pas : il ne peut pas échanger avec lui-même.
    expect(await getMarketSnapshot(sql, users.bob)).toEqual({
      bestEurOffer: 660_000, eurAvailableCents: 50_000, bestXofOffer: 650_000, xofAvailable: 300_000,
    });
  });

  it("marque les ordres de l'utilisateur dans le carnet sans révéler les autres", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 660_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_XOF", amount: 300_000, limitRate: 650_000 });

    const book = await getBookForUser(sql, users.alice);
    expect(book.map((b) => [b.side, b.isMine])).toEqual([["SELL_EUR", true], ["SELL_XOF", false]]);
    expect(Object.keys(book[0]).sort()).toEqual(["isMine", "limitRate", "remaining", "seq", "side"]);
  });

  it("expose aux visiteurs les offres en attente, sans propriétaire", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 660_000 });
    const book = await getPublicBook(sql);
    expect(book).toEqual([expect.objectContaining({ side: "SELL_EUR", remaining: 50_000, limitRate: 660_000, isMine: false })]);
  });

  it("liste les ordres de l'utilisateur avec ce qu'il a donné et reçu", async () => {
    const resting = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 492_000, limitRate: 656_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });

    const [order] = await getMyOrders(sql, users.alice);
    expect(order).toMatchObject({
      id: resting.orderId, status: "open", amount: 492_000, remaining: 164_000, given: 328_000, received: 50_000, tradeCount: 1,
    });
    expect(await getMyOrders(sql, users.chloe)).toEqual([]);
  });

  it("donne le détail d'un ordre à son seul propriétaire", async () => {
    const resting = await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 492_000, limitRate: 656_000 });
    const incoming = await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });

    const mine = await getMyOrder(sql, users.alice, resting.orderId);
    expect(mine?.trades).toEqual([expect.objectContaining({ eurCents: 50_000, xof: 328_000, rate: 656_000, role: "maker" })]);
    expect((await getMyOrder(sql, users.bob, incoming.orderId))?.trades[0].role).toBe("taker");

    // Les échanges d'une même transaction sont listés dans l'ordre d'exécution du moteur.
    await placeOrderForUser(sql, { userId: users.chloe, side: "SELL_EUR", amount: 40_000, limitRate: 658_000 });
    await placeOrderForUser(sql, { userId: users.dan, side: "SELL_EUR", amount: 40_000, limitRate: 656_000 });
    const sweep = await placeOrderForUser(sql, { userId: users.bob, side: "SELL_XOF", amount: 500_000, limitRate: 670_000 });
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
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 492_000, limitRate: 656_000 });
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
      userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 650_000,
    });
    await expect(
      asUser(users.alice, (tx) => tx`update public.orders set remaining = 1 where id = ${orderId}`),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(users.alice, (tx) => tx`truncate public.trades, public.orders`)).rejects.toThrow(
      /permission denied/,
    );
    expect(await order(orderId)).toMatchObject({ remaining: 50_000 });
  });

  it("ne donne aux visiteurs non connectés que le carnet anonymisé", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 660_000 });
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

  it("réserve les coordonnées à leur propriétaire et les règlements à leurs deux participants", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_XOF", amount: 328_000, limitRate: 656_000 });
    await placeOrderForUser(sql, { userId: users.bob, side: "SELL_EUR", amount: 50_000, limitRate: 650_000 });

    const own = await asUser(users.alice, (tx) => tx`select user_id from public.payment_details`);
    expect(own.map((r) => r.user_id)).toEqual([users.alice]);
    expect(await asUser(users.alice, (tx) => tx`select trade_id from public.settlements`)).toHaveLength(1);
    expect(await asUser(users.bob, (tx) => tx`select trade_id from public.settlements`)).toHaveLength(1);
    expect(await asUser(users.chloe, (tx) => tx`select trade_id from public.settlements`)).toHaveLength(0);

    await expect(asUser(users.alice, (tx) => tx`select * from public.pilot_invites`)).rejects.toThrow(/permission denied/);
    await expect(
      asUser(users.alice, (tx) => tx`update public.settlements set taker_sent_at = now()`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(users.alice, (tx) => tx`update public.payment_details set eur_holder = 'Pirate'`),
    ).rejects.toThrow(/permission denied/);
  });

  it("expose un carnet public anonymisé", async () => {
    await placeOrderForUser(sql, { userId: users.alice, side: "SELL_EUR", amount: 50_000, limitRate: 660_000 });

    const book = await asUser(users.bob, (tx) => tx`select * from public.order_book()`);
    expect(book).toEqual([expect.objectContaining({ side: "SELL_EUR", remaining: 50_000, limit_rate: 660_000 })]);
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
        amount: side === "SELL_EUR" ? 1_000 + Math.floor(random() * 15_000) : 10_000 + Math.floor(random() * 100_000),
        limitRate: 645_000 + Math.floor(random() * 20_000),
      };
    });

    const outcomes = await Promise.allSettled(inputs.map((input) => placeOrderForUser(sql, input)));
    // Seuls des refus de limite d'activité sont admis ; tout autre échec est un bug.
    for (const o of outcomes) {
      if (o.status === "rejected") expect(String(o.reason)).toMatch(/demandes en attente|par heure|plafond/);
    }
    const accepted = outcomes.filter((o) => o.status === "fulfilled").length;

    const orders = await allOrders();
    const trades = await allTrades();
    expect(orders).toHaveLength(accepted);
    expect(accepted).toBeGreaterThan(40);
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
