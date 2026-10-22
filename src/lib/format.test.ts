import { describe, expect, it } from "vitest";
import {
  averageRate,
  fmtDate,
  fmtEur,
  fmtEurNumber,
  fmtGiven,
  fmtPct,
  fmtRelative,
  fmtRate,
  fmtReceived,
  fmtXof,
  fmtXofNumber,
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

  it("formate un montant sans unité pour les champs du convertisseur", () => {
    expect(plain(fmtEurNumber(50_000))).toBe("500,00");
    expect(plain(fmtXofNumber(327_978))).toBe("327 978");
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
    // 30 441 centimes contre 199 997 XOF à 657 : affiché 657 et non 656,999.
    expect(averageRate([{ eurCents: 30_441, xof: 199_997 }])).toBe(657_000);
  });

  it("libelle le sens et la date", () => {
    expect(sideLabel("SELL_XOF")).toBe("Francs CFA → Euros");
    expect(sideLabel("SELL_EUR")).toBe("Euros → Francs CFA");
    expect(plain(fmtDate(new Date("2026-10-20T14:05:00Z")))).toBe("20 oct. 2026, 14:05");
    expect(plain(fmtDate(new Date("2026-10-20T14:05:00Z"), "Europe/Paris"))).toBe("20 oct. 2026, 16:05");
  });
});

describe("dates relatives", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("dit à l'instant, en minutes, en heures, hier, puis en jours", () => {
    expect(fmtRelative(ago(20_000), now)).toBe("à l'instant");
    expect(fmtRelative(ago(5 * 60_000), now)).toBe("il y a 5 min");
    expect(fmtRelative(ago(3 * 3_600_000), now)).toBe("il y a 3 h");
    expect(fmtRelative(ago(30 * 3_600_000), now)).toBe("hier");
    expect(fmtRelative(ago(2 * 86_400_000), now)).toBe("il y a 2 jours");
    expect(fmtRelative(new Date("2026-08-01T10:00:00Z"), now).replace(/[  ]/g, " ")).toBe("1 août 2026");
  });
});
