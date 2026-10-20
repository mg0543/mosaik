import { describe, it, expect } from "vitest";
import {
  assertValidOrder,
  commissionPct,
  eurCentsForXof,
  isMatchable,
  parseEurCents,
  parseRate,
  parseXof,
  placeOrder,
  xofForEurCents,
  type Order,
} from "./matching";

/** Vendeur d'EUR : `eur` en euros, `rate` = taux minimum saisi comme un humain. */
const sellEur = (id: string, eur: number, rate: string, seq: number, ownerId = `user-${id}`): Order => ({
  id,
  ownerId,
  side: "SELL_EUR",
  remaining: eur * 100,
  limitRate: parseRate(rate),
  seq,
});

/** Vendeur de XOF : `xof` en XOF, `rate` = taux maximum. */
const sellXof = (id: string, xof: number, rate: string, seq: number, ownerId = `user-${id}`): Order => ({
  id,
  ownerId,
  side: "SELL_XOF",
  remaining: xof,
  limitRate: parseRate(rate),
  seq,
});

describe("conversions exactes", () => {
  it("calcule le XOF exact là où un calcul flottant se trompait", () => {
    // 30,00 € à 654,3 XOF/EUR = 19 629 XOF exactement (le flottant donnait 19 628).
    expect(xofForEurCents(3000, parseRate("654,3"))).toBe(19_629);
  });

  it("arrondit à l'inférieur dans les deux sens sans dépasser le montant de départ", () => {
    const rate = parseRate("655,957");
    const cents = eurCentsForXof(1_000_000, rate);
    expect(cents).toBe(152_449);
    expect(xofForEurCents(cents, rate)).toBeLessThanOrEqual(1_000_000);
  });

  it("refuse les montants et taux non entiers", () => {
    expect(() => xofForEurCents(10.5, 655_957)).toThrow(RangeError);
    expect(() => eurCentsForXof(100, 655.957)).toThrow(RangeError);
  });
});

describe("parseRate", () => {
  it("lit un taux saisi avec une virgule ou un point, sans flottant", () => {
    expect(parseRate("655,957")).toBe(655_957);
    expect(parseRate("655.9")).toBe(655_900);
    expect(parseRate(" 655 ")).toBe(655_000);
  });

  it("refuse plus de trois décimales, le texte et le zéro", () => {
    expect(() => parseRate("655,9571")).toThrow(RangeError);
    expect(() => parseRate("abc")).toThrow(RangeError);
    expect(() => parseRate("-1")).toThrow(RangeError);
    expect(() => parseRate("0")).toThrow(RangeError);
  });
});

describe("parseEurCents et parseXof", () => {
  it("lit un montant en euros en centimes exacts, avec séparateurs de milliers", () => {
    expect(parseEurCents("1000")).toBe(100_000);
    expect(parseEurCents("1 000,5")).toBe(100_050);
    expect(parseEurCents("1 000.50")).toBe(100_050);
    // 1,13 € : le calcul flottant 1.13 * 100 donnerait 112,999…
    expect(parseEurCents("1,13")).toBe(113);
  });

  it("refuse plus de deux décimales, le zéro et le texte", () => {
    expect(() => parseEurCents("10,005")).toThrow(RangeError);
    expect(() => parseEurCents("0")).toThrow(RangeError);
    expect(() => parseEurCents("dix")).toThrow(RangeError);
  });

  it("lit un montant en XOF entier uniquement", () => {
    expect(parseXof("1 000 000")).toBe(1_000_000);
    expect(() => parseXof("1000,5")).toThrow(RangeError);
    expect(() => parseXof("0")).toThrow(RangeError);
    expect(() => parseXof("")).toThrow(RangeError);
  });
});

describe("isMatchable", () => {
  it("considère qu'un reste de XOF inférieur à 1 centime n'est plus appariable", () => {
    const rate = parseRate("655,957");
    expect(isMatchable({ side: "SELL_XOF", remaining: 6, limitRate: rate })).toBe(false);
    expect(isMatchable({ side: "SELL_XOF", remaining: 7, limitRate: rate })).toBe(true);
    expect(isMatchable({ side: "SELL_EUR", remaining: 1, limitRate: rate })).toBe(true);
    expect(isMatchable({ side: "SELL_EUR", remaining: 0, limitRate: rate })).toBe(false);
  });
});

describe("placeOrder : ordre entrant qui vend des XOF (achète des EUR)", () => {
  it("est servi par plusieurs vendeurs d'EUR (matching fractionné)", () => {
    const book = [
      sellEur("B", 800, "655", 1),
      sellEur("C", 400, "656", 2),
      sellEur("D", 250, "657", 3),
      sellEur("E", 200, "658", 4),
    ];

    const result = placeOrder(book, sellXof("A", 1_000_000, "670", 10));

    expect(result.trades.map((t) => t.makerOrderId)).toEqual(["B", "C", "D", "E"]);
    // Tout est dépensé sauf un reste technique, clôturé et signalé.
    const leftover = result.closed.find((c) => c.orderId === "A")?.amount ?? 0;
    expect(result.given + leftover).toBe(1_000_000);
    expect(result.resting).toBeNull();
  });

  it("consomme les vendeurs d'EUR les moins chers en premier", () => {
    const book = [sellEur("cher", 1000, "670", 1), sellEur("bon", 1000, "655", 2)];

    const result = placeOrder(book, sellXof("A", 100_000, "680", 10));

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].makerOrderId).toBe("bon");
  });

  it("laisse le reste d'un vendeur partiellement servi dans le carnet", () => {
    // B possède 2 000 €, A dépense l'équivalent de 1 500 € à 655 XOF/EUR.
    const book = [sellEur("B", 2000, "655", 1)];
    const xof = xofForEurCents(150_000, parseRate("655"));

    const result = placeOrder(book, sellXof("A", xof, "670", 10));

    expect(result.resting).toBeNull();
    expect(result.book).toHaveLength(1);
    expect(result.book[0]).toMatchObject({ id: "B", remaining: 50_000 }); // 500 € restent
  });

  it("retire un vendeur entièrement servi du carnet", () => {
    const book = [sellEur("B", 100, "655", 1), sellEur("C", 500, "656", 2)];

    const result = placeOrder(book, sellXof("A", 65_500, "660", 10));

    expect(result.book.map((o) => o.id)).toEqual(["C"]);
  });

  it("inscrit l'ordre au carnet quand aucun vendeur n'est compatible", () => {
    const book = [sellEur("trop-cher", 1000, "700", 1)];

    const result = placeOrder(book, sellXof("A", 100_000, "670", 10));

    expect(result.trades).toHaveLength(0);
    expect(result.resting).toMatchObject({ id: "A", remaining: 100_000 });
    expect(result.book.map((o) => o.id)).toEqual(["trop-cher", "A"]);
  });

  it("départage les taux égaux par ordre d'arrivée", () => {
    const book = [sellEur("tard", 500, "660", 5), sellEur("tot", 500, "660", 2)];

    const result = placeOrder(book, sellXof("A", 50_000, "660", 10));

    expect(result.trades[0].makerOrderId).toBe("tot");
  });

  it("clôture et signale un reste trop petit pour acheter 1 centime", () => {
    // 65 503 XOF à 655 : 100,00 € coûtent 65 500 XOF, 3 XOF ne valent pas 1 centime.
    const result = placeOrder([sellEur("B", 1000, "655", 1)], sellXof("A", 65_503, "670", 10));

    expect(result.trades[0]).toMatchObject({ eurCents: 10_000, xof: 65_500 });
    expect(result.resting).toBeNull();
    expect(result.closed).toEqual([{ orderId: "A", ownerId: "user-A", side: "SELL_XOF", amount: 3 }]);
  });

  it("inscrit au carnet le reste dû à un manque de liquidité", () => {
    const result = placeOrder([sellEur("B", 100, "655", 1)], sellXof("A", 100_000, "670", 10));

    expect(result.given).toBe(65_500);
    expect(result.resting).toMatchObject({ remaining: 34_500, limitRate: 670_000 });
    expect(result.closed).toHaveLength(0);
  });

  it("ne dépense jamais plus que le montant de l'ordre", () => {
    const book = [sellEur("B", 800, "655,957", 1), sellEur("C", 400, "660,123", 2)];

    const result = placeOrder(book, sellXof("A", 123_457, "670", 10));

    expect(result.given).toBeLessThanOrEqual(123_457);
    for (const t of result.trades) {
      // Le XOF payé n'excède jamais la valeur exacte des centimes reçus au taux du vendeur.
      expect(BigInt(t.xof) * 100_000n).toBeLessThanOrEqual(BigInt(t.eurCents) * BigInt(t.rate));
    }
  });
});

describe("placeOrder : ordre entrant qui vend des EUR (achète des XOF)", () => {
  it("est servi par plusieurs vendeurs de XOF, le plus généreux d'abord", () => {
    const book = [
      sellXof("D", 100_000, "654", 3),
      sellXof("C", 200_000, "655", 2),
      sellXof("B", 300_000, "656", 1),
    ];

    const result = placeOrder(book, sellEur("A", 1000, "650", 10));

    expect(result.trades.map((t) => t.makerOrderId)).toEqual(["B", "C", "D"]);
    // B : 45 731 centimes -> 299 995 XOF
    expect(result.trades[0]).toMatchObject({ eurCents: 45_731, xof: 299_995 });
    expect(result.received).toBe(299_995 + 199_997 + 99_996);
    // Liquidité épuisée : le reste de A s'inscrit au carnet.
    expect(result.resting).toMatchObject({ id: "A", remaining: 8_445 });
  });

  it("clôture et signale les vendeurs dont le reste ne vaut plus 1 centime", () => {
    const book = [sellXof("B", 300_000, "656", 1)];

    const result = placeOrder(book, sellEur("A", 1000, "650", 10));

    expect(result.closed).toEqual([{ orderId: "B", ownerId: "user-B", side: "SELL_XOF", amount: 5 }]);
    expect(result.book.some((o) => o.id === "B")).toBe(false);
  });

  it("consomme les vendeurs les plus avantageux pour l'ordre entrant", () => {
    const book = [sellXof("bas", 1_000_000, "650", 1), sellXof("haut", 1_000_000, "656", 2)];

    const result = placeOrder(book, sellEur("A", 100, "640", 10));

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].makerOrderId).toBe("haut");
    expect(result.received).toBe(65_600);
  });

  it("laisse le reste d'un vendeur partiellement servi dans le carnet", () => {
    const result = placeOrder([sellXof("B", 1_000_000, "655", 1)], sellEur("A", 1000, "650", 10));

    expect(result.received).toBe(655_000);
    expect(result.resting).toBeNull();
    expect(result.book).toEqual([expect.objectContaining({ id: "B", remaining: 345_000 })]);
  });

  it("retire un vendeur entièrement servi du carnet", () => {
    const book = [sellXof("B", 65_500, "655", 1), sellXof("C", 500_000, "654", 2)];

    const result = placeOrder(book, sellEur("A", 100, "650", 10));

    expect(result.trades.map((t) => t.makerOrderId)).toEqual(["B"]);
    expect(result.book.map((o) => o.id)).toEqual(["C"]);
  });

  it("ignore les vendeurs dont le taux maximum est sous le taux minimum demandé", () => {
    const result = placeOrder([sellXof("trop-bas", 1_000_000, "640", 1)], sellEur("A", 100, "650", 10));

    expect(result.trades).toHaveLength(0);
    expect(result.resting).toMatchObject({ remaining: 10_000 });
  });

  it("départage les taux égaux par ordre d'arrivée", () => {
    const book = [sellXof("tard", 500_000, "655", 5), sellXof("tot", 500_000, "655", 2)];

    const result = placeOrder(book, sellEur("A", 100, "655", 10));

    expect(result.trades[0].makerOrderId).toBe("tot");
  });

  it("ne fait jamais donner à un vendeur plus de XOF que son taux maximum", () => {
    const book = [sellXof("B", 400_000, "655,957", 1), sellXof("C", 900_000, "652,123", 2)];

    const result = placeOrder(book, { ...sellEur("A", 1, "650", 10), remaining: 123_457 });

    expect(result.given).toBeLessThanOrEqual(123_457);
    for (const t of result.trades) {
      expect(BigInt(t.xof) * 100_000n).toBeLessThanOrEqual(BigInt(t.eurCents) * BigInt(t.rate));
    }
  });
});

describe("placeOrder : règles du carnet", () => {
  it("exécute au taux de l'ordre déjà inscrit (pay-as-bid)", () => {
    // Un vendeur de XOF attend à 656 ; un vendeur d'EUR prêt à 650 obtient 656.
    const first = placeOrder([], sellXof("X", 656_000, "656", 1));
    const second = placeOrder(first.book, sellEur("E", 1000, "650", 2));

    expect(second.trades).toEqual([
      expect.objectContaining({ makerOrderId: "X", takerOrderId: "E", rate: 656_000, eurCents: 100_000, xof: 656_000 }),
    ]);
    expect(second.book).toHaveLength(0);
  });

  it("n'apparie jamais un utilisateur avec lui-même", () => {
    const book = [sellEur("B", 1000, "655", 1, "meme-personne")];

    const result = placeOrder(book, sellXof("A", 100_000, "670", 10, "meme-personne"));

    expect(result.trades).toHaveLength(0);
    expect(result.resting).not.toBeNull();
  });

  it("ne modifie jamais le carnet d'entrée", () => {
    const book = [sellEur("B", 800, "655", 1), sellXof("C", 500_000, "650", 2)];
    const snapshot = structuredClone(book);

    placeOrder(book, sellXof("A", 100_000, "670", 10));
    placeOrder(book, sellEur("D", 100, "640", 11));

    expect(book).toEqual(snapshot);
  });

  it("rejette un ordre invalide", () => {
    const valid = sellXof("A", 100_000, "670", 10);
    expect(() => placeOrder([], { ...valid, remaining: 0 })).toThrow(RangeError);
    expect(() => placeOrder([], { ...valid, remaining: 10.5 })).toThrow(RangeError);
    expect(() => placeOrder([], { ...valid, limitRate: 0 })).toThrow(RangeError);
    expect(() => placeOrder([], { ...valid, limitRate: 670.5 })).toThrow(RangeError);
    // Moins d'1 centime à son propre taux.
    expect(() => placeOrder([], { ...valid, remaining: 5 })).toThrow(/trop faible/);
    // Identifiant déjà présent.
    expect(() => placeOrder([valid], valid)).toThrow(RangeError);
  });
});

describe("assertValidOrder", () => {
  it("accepte un ordre valide et refuse un ordre non appariable ou mal formé", () => {
    const valid = sellXof("A", 100_000, "670", 10);
    expect(() => assertValidOrder(valid)).not.toThrow();
    expect(() => assertValidOrder({ ...valid, remaining: 5 })).toThrow(/trop faible/);
    expect(() => assertValidOrder({ ...valid, ownerId: "" })).toThrow(RangeError);
    expect(() => assertValidOrder({ ...valid, seq: 1.5 })).toThrow(RangeError);
  });
});

describe("tarification", () => {
  it("rend la commission dégressive selon le montant", () => {
    expect(commissionPct(50_000)).toBe(1);
    expect(commissionPct(200_000)).toBe(0.8);
    expect(commissionPct(600_000)).toBe(0.5);
    expect(commissionPct(3_000_000)).toBe(0.3);
  });
});
