import { describe, it, expect } from "vitest";
import {
  applySpread,
  commissionPct,
  eurCentsForXof,
  matchBuyRequest,
  xofForEurCents,
  type SellEurOffer,
} from "./matching";

const offer = (
  id: string,
  eur: number,
  minRate: number,
  seq: number,
): SellEurOffer => ({
  id,
  ownerId: `user-${id}`,
  eurCentsRemaining: eur * 100,
  minRateXofPerEur: minRate,
  seq,
});

describe("matchBuyRequest", () => {
  it("sert une demande avec plusieurs offres (matching fractionné)", () => {
    const book = [
      offer("B", 800, 655, 1),
      offer("C", 400, 656, 2),
      offer("D", 250, 657, 3),
      offer("E", 200, 658, 4),
    ];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 1_000_000,
      maxRateXofPerEur: 670,
    });

    expect(result.fills.map((f) => f.offerId)).toEqual(["B", "C", "D", "E"]);
    expect(result.xofUnfilled).toBeGreaterThanOrEqual(0);
    expect(result.xofFilled + result.xofUnfilled).toBe(1_000_000);
  });

  it("consomme les offres les moins chères en premier", () => {
    const book = [offer("cher", 1000, 670, 1), offer("bon", 1000, 655, 2)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 100_000,
      maxRateXofPerEur: 680,
    });

    expect(result.fills[0].offerId).toBe("bon");
    expect(result.fills).toHaveLength(1);
  });

  it("laisse le reste d'une offre partiellement consommée dans le carnet", () => {
    // B possède 2 000 €, A veut dépenser l'équivalent de 1 500 € à 655 XOF/EUR
    const book = [offer("B", 2000, 655, 1)];
    const xofToSpend = xofForEurCents(150_000, 655);

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend,
      maxRateXofPerEur: 670,
    });

    expect(result.fills).toHaveLength(1);
    expect(result.xofUnfilled).toBe(0);
    expect(result.book).toHaveLength(1);
    expect(result.book[0].id).toBe("B");
    expect(result.book[0].eurCentsRemaining).toBe(50_000); // 500 € restent disponibles
  });

  it("retire une offre entièrement consommée du carnet", () => {
    const book = [offer("B", 100, 655, 1), offer("C", 500, 656, 2)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 655 * 100,
      maxRateXofPerEur: 660,
    });

    expect(result.book.map((o) => o.id)).toEqual(["C"]);
  });

  it("ignore les offres dont le taux minimum dépasse le taux maximum demandé", () => {
    const book = [offer("trop-cher", 1000, 700, 1)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 100_000,
      maxRateXofPerEur: 670,
    });

    expect(result.fills).toHaveLength(0);
    expect(result.xofUnfilled).toBe(100_000);
    expect(result.book).toHaveLength(1);
  });

  it("départage les taux égaux par ordre d'arrivée", () => {
    const book = [offer("tard", 500, 660, 5), offer("tot", 500, 660, 2)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 50_000,
      maxRateXofPerEur: 660,
    });

    expect(result.fills[0].offerId).toBe("tot");
  });

  it("ne modifie jamais le carnet d'entrée", () => {
    const book = [offer("B", 800, 655, 1)];
    const snapshot = JSON.parse(JSON.stringify(book));

    matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 100_000,
      maxRateXofPerEur: 670,
    });

    expect(book).toEqual(snapshot);
  });

  it("ne dépense jamais plus de XOF que demandé", () => {
    const book = [offer("B", 800, 655.957, 1), offer("C", 400, 660.123, 2)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 123_457,
      maxRateXofPerEur: 670,
    });

    expect(result.xofFilled).toBeLessThanOrEqual(123_457);
    for (const fill of result.fills) {
      expect(fill.xofAmount).toBeLessThanOrEqual(123_457);
    }
  });

  it("rejette un montant invalide", () => {
    expect(() =>
      matchBuyRequest([], { id: "A", ownerId: "u", xofToSpend: 0, maxRateXofPerEur: 660 }),
    ).toThrow(RangeError);
    expect(() =>
      matchBuyRequest([], { id: "A", ownerId: "u", xofToSpend: 10.5, maxRateXofPerEur: 660 }),
    ).toThrow(RangeError);
  });
});

describe("conversions et tarification", () => {
  it("convertit XOF en centimes d'EUR et inversement sans dépasser le montant", () => {
    const cents = eurCentsForXof(1_000_000, 655.957);
    expect(xofForEurCents(cents, 655.957)).toBeLessThanOrEqual(1_000_000);
  });

  it("applique un spread au taux de référence", () => {
    expect(applySpread(655.957, 2)).toBeCloseTo(669.07614, 4);
  });

  it("rend la commission dégressive selon le montant", () => {
    expect(commissionPct(50_000)).toBe(1);
    expect(commissionPct(200_000)).toBe(0.8);
    expect(commissionPct(600_000)).toBe(0.5);
    expect(commissionPct(3_000_000)).toBe(0.3);
  });
});
