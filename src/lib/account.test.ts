import { describe, expect, it } from "vitest";
import { checkPassword, parseEmail, parseName, parseOptionalPhone } from "./account";

describe("mot de passe", () => {
  it("accepte un mot de passe d'au moins 10 caractères avec lettres et chiffres", () => {
    expect(checkPassword("soleil2026dakar")).toBeNull();
    expect(checkPassword("Été2026abcd")).toBeNull();
  });

  it("refuse un mot de passe trop court, trop long, sans chiffre ou sans lettre", () => {
    expect(checkPassword("abc12")).toMatch(/au moins 10/);
    expect(checkPassword("a1".repeat(37))).toMatch(/dépasser 72/);
    expect(checkPassword("seulementdeslettres")).toMatch(/lettre et un chiffre/);
    expect(checkPassword("1234567890")).toMatch(/lettre et un chiffre/);
  });
});

describe("prénom et nom", () => {
  it("accepte accents, tirets, apostrophes et espaces, et nettoie la saisie", () => {
    expect(parseName("  Aïssatou ", "Prénom")).toBe("Aïssatou");
    expect(parseName("N'Diaye-Sall", "Nom")).toBe("N'Diaye-Sall");
    expect(parseName("Jean   Marc", "Prénom")).toBe("Jean Marc");
  });

  it("refuse un champ vide, trop long ou avec des chiffres", () => {
    expect(() => parseName("   ", "Prénom")).toThrow("Prénom invalide.");
    expect(() => parseName("x".repeat(51), "Nom")).toThrow("Nom invalide.");
    expect(() => parseName("R2D2", "Nom")).toThrow("Nom invalide.");
  });
});

describe("téléphone facultatif", () => {
  it("renvoie null quand le champ est vide", () => {
    expect(parseOptionalPhone("")).toBeNull();
    expect(parseOptionalPhone("   ")).toBeNull();
  });

  it("normalise un numéro international de la zone XOF ou d'Europe", () => {
    expect(parseOptionalPhone("+221 77 123 45 67")).toBe("+221771234567");
    expect(parseOptionalPhone("0033 6 12 34 56 78")).toBe("+33612345678");
    expect(parseOptionalPhone("+225 (07) 08-09-10-11")).toBe("+2250708091011");
  });

  it("refuse un numéro sans indicatif ou mal formé", () => {
    expect(() => parseOptionalPhone("06 12 34 56 78")).toThrow(/format international/);
    expect(() => parseOptionalPhone("+221 12")).toThrow(/format international/);
    expect(() => parseOptionalPhone("+0 123456789")).toThrow(/format international/);
  });
});

describe("adresse e-mail", () => {
  it("normalise et valide", () => {
    expect(parseEmail("  Awa.Diop@Exemple.COM ")).toBe("awa.diop@exemple.com");
    expect(() => parseEmail("pas-une-adresse")).toThrow("Adresse e-mail invalide.");
  });
});
