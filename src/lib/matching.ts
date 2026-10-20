/**
 * Moteur de matching de liquidité EUR / XOF.
 *
 * Principes :
 * - Carnet d'ordres à deux côtés : vendeurs d'EUR (SELL_EUR) et vendeurs de XOF (SELL_XOF).
 *   Un nouvel ordre se croise d'abord avec le côté opposé, puis son reste s'inscrit au carnet.
 * - Matching fractionné : un ordre peut être servi par plusieurs contreparties.
 * - Chaque échange s'exécute au taux de l'ordre déjà présent dans le carnet (« pay-as-bid »).
 * - Priorité : meilleur taux pour celui qui arrive, puis ordre d'arrivée.
 * - Un utilisateur ne peut pas se servir lui-même.
 *
 * Exactitude :
 * - Montants en entiers : centimes d'EUR, XOF entiers.
 * - Taux en entiers : millièmes de XOF pour 1 EUR (655 957 = 655,957 XOF/EUR).
 * - Produits et divisions en BigInt : aucun nombre flottant dans les calculs d'argent.
 * - Le montant pivot est un nombre entier de centimes ; le XOF correspondant est arrondi
 *   à l'inférieur. Personne ne donne jamais plus que ce qu'il a engagé.
 *
 * Ce module ne déplace aucun argent. Il calcule seulement des appariements.
 */

/** Taux en millièmes de XOF pour 1 EUR. */
export type RateMilli = number;

/** Taux de référence officiel : 1 EUR = 655,957 XOF (parité fixe). */
export const REFERENCE_RATE: RateMilli = 655_957;

/** Dénominateur commun : 100 centimes par euro × 1 000 millièmes. */
const SCALE = 100_000n;

export type Side = "SELL_EUR" | "SELL_XOF";

export interface Order {
  id: string;
  /** Identifiant anonyme de l'utilisateur (jamais de données personnelles ici). */
  ownerId: string;
  /** SELL_EUR : donne des EUR contre des XOF. SELL_XOF : donne des XOF contre des EUR. */
  side: Side;
  /** Reste à échanger dans la devise donnée : centimes (SELL_EUR) ou XOF (SELL_XOF). */
  remaining: number;
  /**
   * Taux limite : minimum accepté pour SELL_EUR (recevoir au moins N XOF par EUR),
   * maximum accepté pour SELL_XOF (donner au plus N XOF par EUR).
   */
  limitRate: RateMilli;
  /** Ordre d'arrivée, sert à départager les taux identiques. */
  seq: number;
}

export interface Trade {
  /** Ordre déjà présent dans le carnet, dont le taux s'applique. */
  makerOrderId: string;
  makerId: string;
  /** Ordre entrant. */
  takerOrderId: string;
  takerId: string;
  eurCents: number;
  xof: number;
  rate: RateMilli;
}

/** Ordre clôturé parce que son reste vaut moins d'1 centime à son taux. */
export interface ClosedRemainder {
  orderId: string;
  ownerId: string;
  side: Side;
  /** Reste rendu à l'utilisateur, dans la devise de l'ordre. */
  amount: number;
}

export interface PlaceOrderResult {
  trades: Trade[];
  /** Total donné par l'ordre entrant (devise de l'ordre). */
  given: number;
  /** Total reçu par l'ordre entrant (devise opposée). */
  received: number;
  /** Reste de l'ordre entrant inscrit au carnet, ou null. */
  resting: Order | null;
  /** Ordres clôturés avec un reste technique (entrant et contreparties confondus). */
  closed: ClosedRemainder[];
  /** Carnet après exécution, trié par ordre d'arrivée. Le carnet d'entrée n'est pas modifié. */
  book: Order[];
}

/** XOF correspondant à un montant de centimes au taux donné (arrondi à l'inférieur). */
export function xofForEurCents(eurCents: number, rate: RateMilli): number {
  assertNonNegativeInteger(eurCents, "Le montant en centimes");
  assertPositiveInteger(rate, "Le taux");
  return Number((BigInt(eurCents) * BigInt(rate)) / SCALE);
}

/** Centimes correspondant à un montant de XOF au taux donné (arrondi à l'inférieur). */
export function eurCentsForXof(xof: number, rate: RateMilli): number {
  assertNonNegativeInteger(xof, "Le montant en XOF");
  assertPositiveInteger(rate, "Le taux");
  return Number((BigInt(xof) * SCALE) / BigInt(rate));
}

/**
 * Lit un taux saisi par un humain (« 655,957 » ou « 655.957 ») sans passer par un flottant.
 * Trois décimales au plus.
 */
export function parseRate(input: string): RateMilli {
  const match = /^\s*(\d{1,7})(?:[.,](\d{1,3}))?\s*$/.exec(input);
  if (!match) throw new RangeError("Taux invalide : utilisez au plus trois décimales.");
  const rate = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (rate <= 0) throw new RangeError("Le taux doit être positif.");
  return rate;
}

/** Lit un montant en euros (« 1 000,50 », « 1000.5 ») et le convertit en centimes, sans flottant. */
export function parseEurCents(input: string): number {
  const match = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(stripSpaces(input));
  if (!match) throw new RangeError("Montant en euros invalide : au plus deux décimales.");
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents <= 0) throw new RangeError("Le montant doit être positif.");
  return cents;
}

/** Lit un montant en XOF (« 1 000 000 ») : entier uniquement, le XOF n'a pas de subdivision. */
export function parseXof(input: string): number {
  const match = /^\d{1,12}$/.exec(stripSpaces(input));
  if (!match) throw new RangeError("Montant en XOF invalide : nombre entier attendu.");
  const xof = Number(match[0]);
  if (xof <= 0) throw new RangeError("Le montant doit être positif.");
  return xof;
}

/** Retire les espaces, y compris insécables, utilisés comme séparateurs de milliers. */
function stripSpaces(input: string): string {
  return input.replace(/[\s  ]/g, "");
}

/**
 * Un ordre est appariable si son reste vaut au moins 1 centime et 1 XOF à son propre taux.
 * Comme il s'échange toujours à son taux une fois dans le carnet, un ordre non appariable
 * ne le redeviendra jamais.
 */
export function isMatchable(order: Pick<Order, "side" | "remaining" | "limitRate">): boolean {
  if (order.remaining <= 0) return false;
  return order.side === "SELL_XOF"
    ? eurCentsForXof(order.remaining, order.limitRate) > 0
    : xofForEurCents(order.remaining, order.limitRate) > 0;
}

/**
 * Place un ordre dans le carnet.
 *
 * - SELL_XOF entrant : consomme les SELL_EUR dont le taux minimum est inférieur ou égal
 *   à son taux maximum, du moins cher au plus cher.
 * - SELL_EUR entrant : consomme les SELL_XOF dont le taux maximum est supérieur ou égal
 *   à son taux minimum, du plus généreux au moins généreux.
 *
 * Le reste appariable de l'ordre entrant s'inscrit au carnet ; un reste inférieur à
 * 1 centime est clôturé et signalé dans `closed`. Fonction pure.
 */
export function placeOrder(book: readonly Order[], order: Order): PlaceOrderResult {
  assertValidOrder(order);
  if (book.some((o) => o.id === order.id)) {
    throw new RangeError("Un ordre avec cet identifiant existe déjà dans le carnet.");
  }

  const takerSellsXof = order.side === "SELL_XOF";
  const makers = book
    .filter(
      (o) =>
        o.side !== order.side &&
        o.remaining > 0 &&
        o.ownerId !== order.ownerId &&
        (takerSellsXof ? o.limitRate <= order.limitRate : o.limitRate >= order.limitRate),
    )
    .sort((a, b) =>
      takerSellsXof
        ? a.limitRate - b.limitRate || a.seq - b.seq
        : b.limitRate - a.limitRate || a.seq - b.seq,
    );

  const updated = new Map<string, Order>(book.map((o) => [o.id, { ...o }]));
  const trades: Trade[] = [];
  let takerRemaining = order.remaining;

  for (const candidate of makers) {
    if (takerRemaining <= 0) break;
    const maker = updated.get(candidate.id);
    if (!maker || maker.remaining <= 0) continue;

    const rate = maker.limitRate;
    // Le pivot est toujours un nombre entier de centimes, plafonné par ce que chacun peut donner.
    const eurCents = takerSellsXof
      ? Math.min(maker.remaining, eurCentsForXof(takerRemaining, rate))
      : Math.min(takerRemaining, eurCentsForXof(maker.remaining, rate));
    if (eurCents <= 0) continue;
    const xof = xofForEurCents(eurCents, rate);
    if (xof <= 0) continue;

    trades.push({
      makerOrderId: maker.id,
      makerId: maker.ownerId,
      takerOrderId: order.id,
      takerId: order.ownerId,
      eurCents,
      xof,
      rate,
    });

    if (takerSellsXof) {
      maker.remaining -= eurCents;
      takerRemaining -= xof;
    } else {
      maker.remaining -= xof;
      takerRemaining -= eurCents;
    }
  }

  // Les contreparties dont le reste n'est plus appariable sont clôturées et signalées.
  const closed: ClosedRemainder[] = [];
  for (const trade of trades) {
    const maker = updated.get(trade.makerOrderId);
    if (maker && maker.remaining > 0 && !isMatchable(maker)) {
      closed.push({ orderId: maker.id, ownerId: maker.ownerId, side: maker.side, amount: maker.remaining });
      maker.remaining = 0;
    }
  }

  const leftover = { ...order, remaining: takerRemaining };
  let resting: Order | null = null;
  if (isMatchable(leftover)) {
    resting = leftover;
    updated.set(order.id, leftover);
  } else if (takerRemaining > 0) {
    closed.push({ orderId: order.id, ownerId: order.ownerId, side: order.side, amount: takerRemaining });
  }

  const totalEur = trades.reduce((s, t) => s + t.eurCents, 0);
  const totalXof = trades.reduce((s, t) => s + t.xof, 0);

  return {
    trades,
    given: takerSellsXof ? totalXof : totalEur,
    received: takerSellsXof ? totalEur : totalXof,
    resting,
    closed,
    book: [...updated.values()].filter((o) => o.remaining > 0).sort((a, b) => a.seq - b.seq),
  };
}

/** Commission dégressive en fonction du montant de XOF (tranches indicatives, en pourcentage). */
export function commissionPct(xofAmount: number): number {
  if (xofAmount >= 2_000_000) return 0.3;
  if (xofAmount >= 500_000) return 0.5;
  if (xofAmount >= 100_000) return 0.8;
  return 1;
}

function assertValidOrder(order: Order): void {
  assertPositiveInteger(order.remaining, order.side === "SELL_EUR" ? "Le montant en centimes" : "Le montant en XOF");
  assertPositiveInteger(order.limitRate, "Le taux limite");
  if (!Number.isSafeInteger(order.seq)) throw new RangeError("L'ordre d'arrivée doit être un entier.");
  if (!order.id || !order.ownerId) throw new RangeError("L'ordre doit avoir un identifiant et un propriétaire.");
  if (!isMatchable(order)) throw new RangeError("Montant trop faible : il vaut moins d'1 centime à ce taux.");
}

function assertPositiveInteger(n: number, label: string): void {
  if (!Number.isSafeInteger(n) || n <= 0) throw new RangeError(`${label} doit être un entier positif.`);
}

function assertNonNegativeInteger(n: number, label: string): void {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${label} doit être un entier positif ou nul.`);
}
