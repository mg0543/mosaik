/**
 * Mise en forme pour l'affichage (français). Seul endroit où les décimales sont permises :
 * aucune de ces fonctions ne sert à calculer un montant.
 */
import { REFERENCE_RATE, type RateMilli, type Side } from "./matching";

/** 1 000 000 XOF (espace fine insécable comme séparateur de milliers). */
export function fmtXof(xof: number): string {
  return `${xof.toLocaleString("fr-FR")} XOF`;
}

/** 1 524,49 € à partir de centimes. */
export function fmtEur(cents: number): string {
  return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Montant en euros sans unité : 1 524,49 (pour un champ accompagné de « EUR »). */
export function fmtEurNumber(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Montant en XOF sans unité : 1 000 000. */
export function fmtXofNumber(xof: number): string {
  return xof.toLocaleString("fr-FR");
}

/** 655,957 à partir de millièmes. */
export function fmtRate(rate: RateMilli): string {
  return (rate / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 });
}

/** Montant dans la devise que donne un ordre de ce côté. */
export function fmtGiven(side: Side, amount: number): string {
  return side === "SELL_XOF" ? fmtXof(amount) : fmtEur(amount);
}

/** Montant dans la devise que reçoit un ordre de ce côté. */
export function fmtReceived(side: Side, amount: number): string {
  return side === "SELL_XOF" ? fmtEur(amount) : fmtXof(amount);
}

/** Pourcentage arrondi à l'inférieur : jamais « 100 % » tant qu'il reste quelque chose. */
export function fmtPct(part: number, total: number): string {
  if (total <= 0) return "0 %";
  const pct = Math.floor((part / total) * 1000) / 10;
  return `${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/** Écart d'un taux par rapport au taux de référence, ex. « +2,14 % par rapport à la référence ». */
export function rateGap(rate: RateMilli): string {
  const pct = (rate / REFERENCE_RATE - 1) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % par rapport à la référence`;
}

/**
 * Taux moyen d'un ensemble d'échanges, en millièmes, arrondi au centième de XOF (affichage seul).
 * L'arrondi au XOF inférieur de chaque échange ferait sinon afficher « 656,999 » pour une offre à 657.
 */
export function averageRate(trades: readonly { eurCents: number; xof: number }[]): RateMilli {
  const cents = trades.reduce((s, t) => s + t.eurCents, 0);
  const xof = trades.reduce((s, t) => s + t.xof, 0);
  return cents > 0 ? Math.round((xof * 100_000) / cents / 10) * 10 : 0;
}

/** Libellé du sens d'un ordre, du point de vue de son auteur. */
export function sideLabel(side: Side): string {
  return side === "SELL_XOF" ? "Francs CFA → Euros" : "Euros → Francs CFA";
}

/** Date courte : « 20 oct. 2026, 14:05 », dans le fuseau donné (UTC par défaut). */
export function fmtDate(date: Date, timeZone = "UTC"): string {
  return date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone });
}
