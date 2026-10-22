import { describe, expect, it } from "vitest";
import { countryFromPhone, isXofCountry, XOF_COUNTRIES } from "./countries";

describe("pays de la zone XOF", () => {
  it("liste les huit pays de l'UEMOA", () => {
    expect(XOF_COUNTRIES).toHaveLength(8);
  });

  it("déduit le pays d'un numéro international", () => {
    expect(countryFromPhone("+22670123456")).toBe("BF");
    expect(countryFromPhone("+221771234567")).toBe("SN");
    expect(countryFromPhone("+33612345678")).toBeNull();
    expect(countryFromPhone(null)).toBeNull();
  });

  it("reconnaît un code pays valide", () => {
    expect(isXofCountry("CI")).toBe(true);
    expect(isXofCountry("FR")).toBe(false);
  });
});
