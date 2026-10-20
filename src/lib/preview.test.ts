import { describe, expect, it } from "vitest";
import { previewOrder, type PublicBookEntry } from "./preview";

const entry = (side: PublicBookEntry["side"], remaining: number, limitRate: number, seq: number, isMine = false): PublicBookEntry => ({
  side, remaining, limitRate, seq, isMine,
});

describe("previewOrder", () => {
  it("calcule l'aperçu comme le moteur, au taux des ordres inscrits", () => {
    const book = [entry("SELL_EUR", 100_000, 655_000, 1), entry("SELL_EUR", 100_000, 660_000, 2)];

    const result = previewOrder(book, { side: "SELL_XOF", amount: 2_000_000, limitRate: 670_000 });

    expect(result.trades.map((t) => t.rate)).toEqual([655_000, 660_000]);
    expect(result.given).toBe(655_000 + 660_000);
    expect(result.received).toBe(200_000);
    expect(result.resting?.remaining).toBe(685_000);
  });

  it("ne s'apparie pas avec les ordres de l'utilisateur", () => {
    const book = [entry("SELL_EUR", 100_000, 655_000, 1, true), entry("SELL_EUR", 100_000, 660_000, 2)];

    const result = previewOrder(book, { side: "SELL_XOF", amount: 100_000, limitRate: 670_000 });

    expect(result.trades).toHaveLength(1);
    expect(result.trades[0].rate).toBe(660_000);
  });

  it("donne à l'aperçu un ordre d'arrivée postérieur au carnet", () => {
    const result = previewOrder([entry("SELL_XOF", 300_000, 650_000, 41)], { side: "SELL_EUR", amount: 100, limitRate: 660_000 });

    expect(result.trades).toHaveLength(0);
    expect(result.resting?.seq).toBe(42);
  });
});
