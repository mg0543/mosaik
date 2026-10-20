import { describe, expect, it } from "vitest";
import {
  averageRate,
  fmtDate,
  fmtEur,
  fmtGiven,
  fmtPct,
  fmtRate,
  fmtReceived,
  fmtXof,
  rateGap,
  sideLabel,
} from "./format";

// toLocaleString("fr-FR") utilise des espaces insécables : on les normalise pour comparer.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("mise en forme", () => {
  it("formate les montants en XOF et en euros", () => {
    expect(plain(fmtXof(1_000_000))).toBe("1 000 000 XOF");
    expect(plain(fmtEur(152_449))).toBe("1 524,49 €");
    expect(plain(fmtEur(5))).toBe("0,05 €");
  });

  it("formate un taux en millièmes", () => {
    expect(fmtRate(655_957)).toBe("655,957");
    expect(fmtRate(660_000)).toBe("660");
  });

  it("choisit la devise donnée et reçue selon le sens", () => {
    expect(plain(fmtGiven("SELL_XOF", 1000))).toBe("1 000 XOF");
    expect(plain(fmtGiven("SELL_EUR", 1000))).toBe("10,00 €");
    expect(plain(fmtReceived("SELL_XOF", 1000))).toBe("10,00 €");
    expect(plain(fmtReceived("SELL_EUR", 1000))).toBe("1 000 XOF");
  });

  it("n'affiche jamais 100 % tant qu'il reste un montant", () => {
    expect(plain(fmtPct(999_999, 1_000_000))).toBe("99,9 %");
    expect(plain(fmtPct(1_000_000, 1_000_000))).toBe("100 %");
    expect(plain(fmtPct(1, 0))).toBe("0 %");
  });

  it("exprime l'écart au taux de référence", () => {
    expect(plain(rateGap(670_000))).toBe("+2,14 % par rapport à la référence");
    expect(plain(rateGap(650_000))).toBe("−0,91 % par rapport à la référence");
    expect(plain(rateGap(655_957))).toBe("0 % par rapport à la référence");
  });

  it("calcule le taux moyen d'échanges", () => {
    expect(averageRate([{ eurCents: 100_000, xof: 655_000 }, { eurCents: 100_000, xof: 657_000 }])).toBe(656_000);
    expect(averageRate([])).toBe(0);
  });

  it("libelle le sens et la date", () => {
    expect(sideLabel("SELL_XOF")).toBe("XOF → EUR");
    expect(sideLabel("SELL_EUR")).toBe("EUR → XOF");
    expect(plain(fmtDate(new Date("2026-10-20T14:05:00Z")))).toBe("20 oct. 2026, 14:05");
    expect(plain(fmtDate(new Date("2026-10-20T14:05:00Z"), "Europe/Paris"))).toBe("20 oct. 2026, 16:05");
  });
});
