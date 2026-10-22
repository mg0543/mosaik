import { describe, expect, it } from "vitest";
import {
  checkActivityPolicy,
  checkOrderPolicy,
  checkVolumePolicy,
  MAX_DAILY_XOF,
  MAX_MONTHLY_XOF,
  MAX_OPEN_ORDERS,
  MAX_ORDER_XOF,
  MAX_ORDERS_PER_HOUR,
  rateBand,
  remainingAllowance,
  xofEquivalent,
} from "./policy";

describe("checkActivityPolicy", () => {
  it("laisse passer une activité normale", () => {
    expect(checkActivityPolicy(0, 0)).toBeNull();
    expect(checkActivityPolicy(MAX_OPEN_ORDERS - 1, MAX_ORDERS_PER_HOUR - 1)).toBeNull();
  });

  it("bloque au-delà des ordres ouverts ou du rythme horaire", () => {
    expect(checkActivityPolicy(MAX_OPEN_ORDERS, 0)).toMatch(/demandes en attente/);
    expect(checkActivityPolicy(0, MAX_ORDERS_PER_HOUR)).toMatch(/par heure/);
  });
});

describe("rateBand", () => {
  it("donne les bornes à ±15 % autour de 655,957", () => {
    expect(rateBand()).toEqual({ low: 557_564, high: 754_350 });
  });
});

describe("checkOrderPolicy", () => {
  it("accepte un ordre raisonnable dans les deux sens", () => {
    expect(checkOrderPolicy("SELL_XOF", 400_000, 670_000)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 50_000, 650_000)).toBeNull();
  });

  it("refuse un taux trop éloigné de la référence (faute de frappe)", () => {
    expect(checkOrderPolicy("SELL_XOF", 100_000, 6_559_000)).toMatch(/Taux hors limites/);
    expect(checkOrderPolicy("SELL_EUR", 50_000, 65_500)).toMatch(/Taux hors limites/);
    // Bornes : ±15 % autour de 655,957 -> [557,564 ; 754,350]
    expect(checkOrderPolicy("SELL_EUR", 50_000, 557_564)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 50_000, 557_563)).toMatch(/Taux hors limites/);
    expect(checkOrderPolicy("SELL_EUR", 50_000, 754_350)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 50_000, 754_351)).toMatch(/Taux hors limites/);
  });

  it("refuse un montant au-delà du plafond par échange, en XOF ou en euros", () => {
    expect(checkOrderPolicy("SELL_XOF", MAX_ORDER_XOF, 655_957)).toBeNull();
    expect(checkOrderPolicy("SELL_XOF", MAX_ORDER_XOF + 1, 655_957)).toMatch(/Montant trop élevé/);
    // 3 048,98 € = 1 999 999 XOF au taux officiel ; 3 048,99 € = 2 000 006 XOF
    expect(checkOrderPolicy("SELL_EUR", 304_898, 655_957)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 304_899, 655_957)).toMatch(/Montant trop élevé/);
  });
});

describe("plafonds journalier et mensuel", () => {
  it("suivent les limites de la monnaie électronique BCEAO", () => {
    expect(MAX_ORDER_XOF).toBe(2_000_000);
    expect(MAX_DAILY_XOF).toBe(2_000_000);
    expect(MAX_MONTHLY_XOF).toBe(10_000_000);
  });

  it("convertit un montant en euros en XOF au taux officiel", () => {
    expect(xofEquivalent("SELL_XOF", 150_000)).toBe(150_000);
    expect(xofEquivalent("SELL_EUR", 100_000)).toBe(655_957);
  });

  it("refuse un échange qui ferait dépasser le plafond du jour, en indiquant ce qui reste", () => {
    expect(checkVolumePolicy("SELL_XOF", 500_000, { today: 1_500_000, month: 1_500_000 })).toBeNull();
    expect(checkVolumePolicy("SELL_XOF", 500_001, { today: 1_500_000, month: 1_500_000 })).toMatch(
      /dépasse votre plafond journalier.*il vous reste 500\s000 XOF aujourd'hui/,
    );
  });

  it("refuse un échange qui ferait dépasser le plafond du mois", () => {
    expect(checkVolumePolicy("SELL_EUR", 100_000, { today: 0, month: 9_500_000 })).toMatch(/dépasse votre plafond mensuel/);
    expect(checkVolumePolicy("SELL_XOF", 500_000, { today: 0, month: 9_500_000 })).toBeNull();
  });

  it("calcule ce qu'il reste : le plus contraignant des plafonds", () => {
    expect(remainingAllowance({ today: 0, month: 0 })).toBe(2_000_000);
    expect(remainingAllowance({ today: 1_200_000, month: 1_200_000 })).toBe(800_000);
    expect(remainingAllowance({ today: 0, month: 9_700_000 })).toBe(300_000);
    expect(remainingAllowance({ today: 2_500_000, month: 2_500_000 })).toBe(0);
  });
});
