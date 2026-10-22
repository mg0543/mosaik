import { describe, expect, it } from "vitest";
import { marketOffers } from "./offers";
import type { PublicBookEntry } from "./preview";

const e = (side: PublicBookEntry["side"], remaining: number, limitRate: number, seq: number, isMine = false): PublicBookEntry => ({
  side, remaining, limitRate, seq, isMine,
});

describe("marketOffers", () => {
  it("classe les offres de la meilleure à la moins bonne et exclut les siennes", () => {
    const { forXof, forEur } = marketOffers([
      e("SELL_XOF", 300_000, 652_000, 1),
      e("SELL_XOF", 200_000, 656_000, 2),
      e("SELL_XOF", 100_000, 660_000, 3, true),
      e("SELL_EUR", 50_000, 660_000, 4),
      e("SELL_EUR", 30_000, 655_000, 5),
    ]);
    expect(forXof.map((o) => o.rate)).toEqual([656_000, 652_000]);
    expect(forEur.map((o) => o.rate)).toEqual([655_000, 660_000]);
  });

  it("calcule ce qu'il faut envoyer pour prendre toute l'offre", () => {
    const { forXof, forEur } = marketOffers([e("SELL_XOF", 656_000, 656_000, 1), e("SELL_EUR", 30_000, 655_000, 2)]);
    // 656 000 XOF à 656 : il faut envoyer 1 000 €.
    expect(forXof[0]).toMatchObject({ takerSide: "SELL_EUR", takerAmount: 100_000 });
    // 300 € à 655 : il faut envoyer 196 500 XOF.
    expect(forEur[0]).toMatchObject({ takerSide: "SELL_XOF", takerAmount: 196_500 });
  });

  it("écarte les restes trop petits et limite le nombre d'offres", () => {
    const many = Array.from({ length: 8 }, (_, i) => e("SELL_EUR", 10_000, 655_000 + i * 1000, i + 1));
    expect(marketOffers([...many, e("SELL_XOF", 5, 656_000, 99)]).forXof).toHaveLength(0);
    expect(marketOffers(many, 5).forEur).toHaveLength(5);
  });
});
