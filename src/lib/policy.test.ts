import { describe, expect, it } from "vitest";
import { checkActivityPolicy, checkOrderPolicy, MAX_OPEN_ORDERS, MAX_ORDER_XOF, MAX_ORDERS_PER_HOUR } from "./policy";

describe("checkActivityPolicy", () => {
  it("laisse passer une activité normale", () => {
    expect(checkActivityPolicy(0, 0)).toBeNull();
    expect(checkActivityPolicy(MAX_OPEN_ORDERS - 1, MAX_ORDERS_PER_HOUR - 1)).toBeNull();
  });

  it("bloque au-delà des ordres ouverts ou du rythme horaire", () => {
    expect(checkActivityPolicy(MAX_OPEN_ORDERS, 0)).toMatch(/ordres en attente/);
    expect(checkActivityPolicy(0, MAX_ORDERS_PER_HOUR)).toMatch(/par heure/);
  });
});

describe("checkOrderPolicy", () => {
  it("accepte un ordre raisonnable dans les deux sens", () => {
    expect(checkOrderPolicy("SELL_XOF", 1_000_000, 670_000)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 100_000, 650_000)).toBeNull();
  });

  it("refuse un taux trop éloigné de la référence (faute de frappe)", () => {
    expect(checkOrderPolicy("SELL_XOF", 100_000, 6_559_000)).toMatch(/Taux hors limites/);
    expect(checkOrderPolicy("SELL_EUR", 100_000, 65_500)).toMatch(/Taux hors limites/);
    // Bornes : ±15 % autour de 655,957 -> [557,564 ; 754,350]
    expect(checkOrderPolicy("SELL_EUR", 100_000, 557_564)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 100_000, 557_563)).toMatch(/Taux hors limites/);
    expect(checkOrderPolicy("SELL_EUR", 100_000, 754_350)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 100_000, 754_351)).toMatch(/Taux hors limites/);
  });

  it("refuse un montant au-delà du plafond du pilote, en XOF ou en euros", () => {
    expect(checkOrderPolicy("SELL_XOF", MAX_ORDER_XOF, 655_957)).toBeNull();
    expect(checkOrderPolicy("SELL_XOF", MAX_ORDER_XOF + 1, 655_957)).toMatch(/Montant trop élevé/);
    // 7 622,45 € ≈ 5 000 000 XOF au taux de référence
    expect(checkOrderPolicy("SELL_EUR", 762_245, 655_957)).toBeNull();
    expect(checkOrderPolicy("SELL_EUR", 762_246, 655_957)).toMatch(/Montant trop élevé/);
  });
});
