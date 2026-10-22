import { describe, expect, it } from "vitest";
import { REFERENCE_RATE } from "./matching";
import type { PublicBookEntry } from "./preview";
import { quote } from "./quote";

const offer = (side: PublicBookEntry["side"], remaining: number, limitRate: number, seq: number, isMine = false): PublicBookEntry => ({
  side, remaining, limitRate, seq, isMine,
});

describe("quote (convertisseur)", () => {
  it("sans offre : tout attend au taux officiel", () => {
    const q = quote([], "SELL_EUR", 10_000);
    expect(q.limitRate).toBe(REFERENCE_RATE);
    expect(q.result.trades).toHaveLength(0);
    expect(q.fullyMatched).toBe(false);
    expect(q.waiting).toBe(10_000);
    expect(q.waitingWouldReceive).toBe(65_595); // 100 € au taux officiel
    expect(q.totalEstimate).toBe(65_595);
  });

  it("avec assez d'offres : prend la meilleure et fixe le taux sur la dernière offre utilisée", () => {
    const book = [offer("SELL_EUR", 100_000, 660_000, 1), offer("SELL_EUR", 100_000, 656_000, 2)];
    const q = quote(book, "SELL_XOF", 100_000);
    expect(q.limitRate).toBe(656_000);
    expect(q.fullyMatched).toBe(true);
    expect(q.result.trades.map((t) => t.rate)).toEqual([656_000]);
    expect(q.result.received).toBe(15_243); // 152,43 €
    expect(q.waiting).toBe(0);
  });

  it("sans assez d'offres : sert ce qui est possible, le reste attend au taux le moins favorable des deux", () => {
    // Une offre à 660 (moins favorable que le taux officiel pour qui achète des euros).
    const q = quote([offer("SELL_EUR", 10_000, 660_000, 1)], "SELL_XOF", 400_000);
    expect(q.result.received).toBe(10_000);
    expect(q.limitRate).toBe(660_000);
    expect(q.waiting).toBe(334_000);
    expect(q.waitingWouldReceive).toBe(50_606);
    expect(q.totalEstimate).toBe(60_606);
  });

  it("garde le taux officiel pour le reste quand les offres prises étaient plus favorables", () => {
    const q = quote([offer("SELL_EUR", 10_000, 650_000, 1)], "SELL_XOF", 400_000);
    expect(q.limitRate).toBe(REFERENCE_RATE);
    expect(q.result.trades).toHaveLength(1);
  });

  it("fonctionne dans l'autre sens (vendre des euros)", () => {
    const q = quote([offer("SELL_XOF", 300_000, 650_000, 1)], "SELL_EUR", 100_000);
    // 300 000 XOF à 650 couvrent 461,53 € ; le reste attend à 650 (moins favorable que l'officiel).
    expect(q.limitRate).toBe(650_000);
    expect(q.result.trades).toHaveLength(1);
    expect(q.waiting).toBeGreaterThan(0);
  });

  it("ignore les offres de l'utilisateur lui-même", () => {
    const q = quote([offer("SELL_EUR", 100_000, 656_000, 1, true)], "SELL_XOF", 100_000);
    expect(q.result.trades).toHaveLength(0);
    expect(q.limitRate).toBe(REFERENCE_RATE);
  });
});
