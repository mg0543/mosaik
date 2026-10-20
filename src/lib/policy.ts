/**
 * Garde-fous du pilote, appliqués avant d'enregistrer un ordre. Valeurs à valider :
 * elles protègent les utilisateurs des fautes de frappe et limitent l'exposition.
 */
import { REFERENCE_RATE, xofForEurCents, type RateMilli, type Side } from "./matching";

/** Écart maximal du taux limite autour du taux de référence, en pourcentage. */
export const RATE_BAND_PCT = 15;

/** Montant maximal d'un ordre, exprimé en XOF (au taux de référence pour un ordre en euros). */
export const MAX_ORDER_XOF = 5_000_000;

/** Renvoie la raison du refus, ou null si l'ordre respecte les garde-fous. */
export function checkOrderPolicy(side: Side, amount: number, limitRate: RateMilli): string | null {
  const low = Math.ceil((REFERENCE_RATE * (100 - RATE_BAND_PCT)) / 100);
  const high = Math.floor((REFERENCE_RATE * (100 + RATE_BAND_PCT)) / 100);
  if (limitRate < low || limitRate > high) {
    return `Taux hors limites : il doit rester à ±${RATE_BAND_PCT} % du taux de référence.`;
  }
  const xofEquivalent = side === "SELL_XOF" ? amount : xofForEurCents(amount, REFERENCE_RATE);
  if (xofEquivalent > MAX_ORDER_XOF) {
    return `Montant trop élevé pour le pilote : ${MAX_ORDER_XOF.toLocaleString("fr-FR")} XOF au plus par ordre (ou l'équivalent en euros).`;
  }
  return null;
}
