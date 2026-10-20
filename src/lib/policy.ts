/**
 * Garde-fous du pilote, appliqués avant d'enregistrer un ordre. Valeurs à valider :
 * elles protègent les utilisateurs des fautes de frappe et limitent l'exposition.
 */
import { REFERENCE_RATE, xofForEurCents, type RateMilli, type Side } from "./matching";

/** Écart maximal du taux limite autour du taux de référence, en pourcentage. */
export const RATE_BAND_PCT = 15;

/** Montant maximal d'un ordre, exprimé en XOF (au taux de référence pour un ordre en euros). */
// Bas pendant le pilote : le règlement se fait directement entre participants, sans séquestre.
export const MAX_ORDER_XOF = 500_000;

/** Nombre maximal d'ordres ouverts en même temps par utilisateur. */
export const MAX_OPEN_ORDERS = 10;

/** Nombre maximal d'ordres passés par heure et par utilisateur. */
export const MAX_ORDERS_PER_HOUR = 30;

/**
 * Limites d'activité : empêchent un compte de saturer le carnet. Renvoie la raison du refus,
 * ou null. À vérifier sous le verrou du carnet, avec des compteurs lus dans la même transaction.
 */
export function checkActivityPolicy(openOrders: number, ordersLastHour: number): string | null {
  if (openOrders >= MAX_OPEN_ORDERS) {
    return `Vous avez déjà ${MAX_OPEN_ORDERS} ordres en attente : annulez-en un avant d'en passer un nouveau.`;
  }
  if (ordersLastHour >= MAX_ORDERS_PER_HOUR) {
    return `Limite de ${MAX_ORDERS_PER_HOUR} ordres par heure atteinte. Réessayez un peu plus tard.`;
  }
  return null;
}

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
