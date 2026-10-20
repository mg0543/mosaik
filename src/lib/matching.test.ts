import { describe, it, expect } from "vitest";
import {
  applySpread,
  commissionPct,
  eurCentsForXof,
  matchBuyRequest,
  matchBuyXofRequest,
  xofForEurCents,
  type SellEurOffer,
  type SellXofOffer,
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

  it("isole le reste d'arrondi quand une offre acceptable a encore des EUR", () => {
    // 65 503 XOF à 655 XOF/EUR : 100,00 € coûtent 65 500 XOF, les 3 XOF restants
    // ne suffisent pas pour 1 centime (6,55 XOF).
    const book = [offer("B", 1000, 655, 1)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 65_503,
      maxRateXofPerEur: 670,
    });

    expect(result.fills[0].eurCents).toBe(10_000);
    expect(result.xofFilled).toBe(65_500);
    expect(result.xofUnfilled).toBe(3);
    expect(result.xofRoundingRemainder).toBe(3);
  });

  it("ne confond pas un manque de liquidité avec un reste d'arrondi", () => {
    const book = [offer("B", 100, 655, 1)];

    const result = matchBuyRequest(book, {
      id: "A",
      ownerId: "user-A",
      xofToSpend: 100_000,
      maxRateXofPerEur: 670,
    });

    expect(result.xofFilled).toBe(65_500);
    expect(result.xofUnfilled).toBe(34_500);
    expect(result.xofRoundingRemainder).toBe(0);
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

const xofOffer = (
  id: string,
  xof: number,
  maxRate: number,
  seq: number,
): SellXofOffer => ({
  id,
  ownerId: `user-${id}`,
  xofRemaining: xof,
  maxRateXofPerEur: maxRate,
  seq,
});

describe("matchBuyXofRequest", () => {
  it("sert une demande avec plusieurs vendeurs de XOF, taux le plus élevé d'abord", () => {
    const book = [
      xofOffer("D", 100_000, 654, 3),
      xofOffer("C", 200_000, 655, 2),
      xofOffer("B", 300_000, 656, 1),
    ];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 100_000, // 1 000 €
      minRateXofPerEur: 650,
    });

    expect(result.fills.map((f) => f.offerId)).toEqual(["B", "C", "D"]);
    // B : 45 731 centimes -> 299 995 XOF (reste 5 XOF)
    expect(result.fills[0]).toMatchObject({ eurCents: 45_731, xofAmount: 299_995 });
    expect(result.eurCentsFilled + result.eurCentsUnfilled).toBe(100_000);
    expect(result.eurCentsUnfilled).toBe(8_445); // liquidité épuisée
    expect(result.xofReceived).toBe(299_995 + 199_997 + 99_996);
  });

  it("conserve et laisse visibles les restes techniques de quelques XOF", () => {
    const book = [xofOffer("B", 300_000, 656, 1)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 100_000,
      minRateXofPerEur: 650,
    });

    expect(result.book).toHaveLength(1);
    expect(result.book[0].xofRemaining).toBe(5);
    // Le reste ne vaut pas 1 centime : il n'est plus appariable dans ce sens.
    expect(eurCentsForXof(result.book[0].xofRemaining, 656)).toBe(0);
  });

  it("consomme les offres les plus avantageuses pour le demandeur en premier", () => {
    const book = [xofOffer("bas", 1_000_000, 650, 1), xofOffer("haut", 1_000_000, 656, 2)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 10_000,
      minRateXofPerEur: 640,
    });

    expect(result.fills).toHaveLength(1);
    expect(result.fills[0].offerId).toBe("haut");
    expect(result.xofReceived).toBe(65_600);
  });

  it("laisse le reste d'une offre partiellement consommée dans le carnet", () => {
    // B possède 1 000 000 XOF, A dépense 1 000 € à 655 XOF/EUR
    const book = [xofOffer("B", 1_000_000, 655, 1)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 100_000,
      minRateXofPerEur: 650,
    });

    expect(result.fills).toHaveLength(1);
    expect(result.xofReceived).toBe(655_000);
    expect(result.eurCentsUnfilled).toBe(0);
    expect(result.book).toHaveLength(1);
    expect(result.book[0].xofRemaining).toBe(345_000);
  });

  it("retire une offre entièrement consommée du carnet", () => {
    const book = [xofOffer("B", 65_500, 655, 1), xofOffer("C", 500_000, 654, 2)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 10_000,
      minRateXofPerEur: 650,
    });

    expect(result.fills.map((f) => f.offerId)).toEqual(["B"]);
    expect(result.book.map((o) => o.id)).toEqual(["C"]);
  });

  it("ignore les offres dont le taux maximum est inférieur au taux minimum demandé", () => {
    const book = [xofOffer("trop-bas", 1_000_000, 640, 1)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 10_000,
      minRateXofPerEur: 650,
    });

    expect(result.fills).toHaveLength(0);
    expect(result.eurCentsUnfilled).toBe(10_000);
    expect(result.xofReceived).toBe(0);
    expect(result.book).toHaveLength(1);
  });

  it("départage les taux égaux par ordre d'arrivée", () => {
    const book = [xofOffer("tard", 500_000, 655, 5), xofOffer("tot", 500_000, 655, 2)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 10_000,
      minRateXofPerEur: 655,
    });

    expect(result.fills[0].offerId).toBe("tot");
  });

  it("ne modifie jamais le carnet d'entrée", () => {
    const book = [xofOffer("B", 500_000, 655, 1)];
    const snapshot = JSON.parse(JSON.stringify(book));

    matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 10_000,
      minRateXofPerEur: 650,
    });

    expect(book).toEqual(snapshot);
  });

  it("ne dépense jamais plus d'EUR que demandé et respecte le taux de chaque vendeur", () => {
    const book = [xofOffer("B", 400_000, 655.957, 1), xofOffer("C", 900_000, 652.123, 2)];

    const result = matchBuyXofRequest(book, {
      id: "A",
      ownerId: "user-A",
      eurCentsToSpend: 123_457,
      minRateXofPerEur: 650,
    });

    expect(result.eurCentsFilled).toBeLessThanOrEqual(123_457);
    for (const fill of result.fills) {
      // Le vendeur de XOF ne livre jamais plus que son taux maximum.
      expect(fill.xofAmount * 100).toBeLessThanOrEqual(fill.eurCents * fill.rateXofPerEur);
      expect(Number.isInteger(fill.xofAmount)).toBe(true);
      expect(Number.isInteger(fill.eurCents)).toBe(true);
    }
  });

  it("rejette un montant ou un taux invalide", () => {
    const request = { id: "A", ownerId: "u", eurCentsToSpend: 10_000, minRateXofPerEur: 650 };
    expect(() => matchBuyXofRequest([], { ...request, eurCentsToSpend: 0 })).toThrow(RangeError);
    expect(() => matchBuyXofRequest([], { ...request, eurCentsToSpend: 10.5 })).toThrow(RangeError);
    expect(() => matchBuyXofRequest([], { ...request, minRateXofPerEur: 0 })).toThrow(RangeError);
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
