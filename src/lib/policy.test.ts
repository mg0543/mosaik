import { describe, expect, it } from "vitest";
import { checkActivityPolicy, checkOrderPolicy, rateBand, MAX_OPEN_ORDERS, MAX_ORDER_XOF, MAX_ORDERS_PER_HOUR } from "./policy";

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

  it("refuse un montant au-delà du plafond du pilote, en XOF ou en euros", () => {
    expect(checkOrderPolicy("SELL_XOF", MAX_ORDER_XOF, 655_957)).toBeNull();
    expect(checkOrderPolicy("SELL_XOF", MAX_ORDER_XOF + 1, 655_957)).toMatch(/Montant trop élevé/);
    // 762,24 € = 499 996 XOF au taux de référence ; 762,25 € = 500 003 XOF
    expect(checkOrderPolicy("SELL_EUR", 76_224, 655_957)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 76_225, 655_957)).toMatch(/Montant trop élevé/);
  });
});
