import { describe, expect, it } from "vitest";
import {
  describePayTo,
  fmtIban,
  fmtPhone,
  isValidIban,
  isXofOperator,
  parseHolder,
  parseIban,
  parseXofPhone,
  payToFor,
  receivedCurrency,
} from "./payment";

// IBAN d'exemple publiés (aucun compte réel) : exemple français officiel et exemple belge.
const FR_EXAMPLE = "FR7630006000011234567890189";
const BE_EXAMPLE = "BE68539007547034";

describe("IBAN", () => {
  it("accepte un IBAN dont la clé de contrôle est juste", () => {
    expect(isValidIban(FR_EXAMPLE)).toBe(true);
    expect(isValidIban(BE_EXAMPLE)).toBe(true);
  });

  it("refuse une faute de frappe (clé de contrôle fausse)", () => {
    expect(isValidIban("FR7630006000011234567890188")).toBe(false);
    expect(isValidIban("BE68539007547035")).toBe(false);
  });

  it("normalise une saisie libre et refuse le reste", () => {
    expect(parseIban("fr76 3000 6000 0112 3456 7890 189")).toBe(FR_EXAMPLE);
    expect(() => parseIban("FR76 1234")).toThrow(RangeError);
    expect(() => parseIban("pas un iban")).toThrow(RangeError);
  });

  it("s'affiche par groupes de quatre", () => {
    expect(fmtIban(FR_EXAMPLE)).toBe("FR76 3000 6000 0112 3456 7890 189");
  });
});

describe("numéro mobile money", () => {
  it("accepte les numéros de la zone XOF, avec ou sans espaces", () => {
    expect(parseXofPhone("+221 77 123 45 67")).toBe("+221771234567");
    expect(parseXofPhone("00225 07 08 09 10 11")).toBe("+2250708091011");
    expect(parseXofPhone("+226-70-12-34-56")).toBe("+22670123456");
  });

  it("refuse les numéros hors zone XOF ou mal formés", () => {
    expect(() => parseXofPhone("+33 6 12 34 56 78")).toThrow(/zone XOF/);
    expect(() => parseXofPhone("+237 6 12 34 56 78")).toThrow(/zone XOF/); // Cameroun : XAF, pas XOF
    expect(() => parseXofPhone("77 123 45 67")).toThrow(/zone XOF/);
    expect(() => parseXofPhone("+221 12")).toThrow(/zone XOF/);
  });

  it("s'affiche lisiblement", () => {
    expect(fmtPhone("+221771234567")).toBe("+221 77 123 45 67");
    expect(fmtPhone("+22670123456")).toBe("+226 70 12 34 56");
    expect(fmtPhone("+2250708091011")).toBe("+225 07 08 09 10 11");
  });
});

describe("coordonnée à figer", () => {
  const empty = { eurIban: null, eurHolder: null, xofOperator: null, xofPhone: null, xofHolder: null };

  it("associe à chaque sens la devise reçue", () => {
    expect(receivedCurrency("SELL_XOF")).toBe("EUR");
    expect(receivedCurrency("SELL_EUR")).toBe("XOF");
  });

  it("fournit la coordonnée complète de la devise demandée, ou rien", () => {
    const details = { ...empty, eurIban: FR_EXAMPLE, eurHolder: "Jean Martin" };
    expect(payToFor(details, "EUR")).toEqual({ method: "iban", account: FR_EXAMPLE, holder: "Jean Martin" });
    expect(payToFor(details, "XOF")).toBeNull();
    expect(payToFor({ ...empty, xofOperator: "wave", xofPhone: "+221771234567", xofHolder: "Awa Diop" }, "XOF")).toEqual({
      method: "wave", account: "+221771234567", holder: "Awa Diop",
    });
  });
});

describe("titulaire et opérateur", () => {
  it("nettoie le nom du titulaire et borne sa longueur", () => {
    expect(parseHolder("  Awa   Diop ")).toBe("Awa Diop");
    expect(() => parseHolder("A")).toThrow(RangeError);
    expect(() => parseHolder("x".repeat(71))).toThrow(RangeError);
  });

  it("reconnaît les opérateurs connus", () => {
    expect(isXofOperator("wave")).toBe(true);
    expect(isXofOperator("paypal")).toBe(false);
    expect(isXofOperator(undefined)).toBe(false);
  });

  it("décrit une coordonnée figée", () => {
    expect(describePayTo({ method: "wave", account: "+221771234567", holder: "Awa Diop" })).toEqual({
      method: "Wave", account: "+221 77 123 45 67", holder: "Awa Diop",
    });
    expect(describePayTo({ method: "iban", account: FR_EXAMPLE, holder: "Jean Martin" }).account).toBe(
      "FR76 3000 6000 0112 3456 7890 189",
    );
  });
});
