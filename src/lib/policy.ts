/**
 * Garde-fous du pilote, appliqués avant d'enregistrer un ordre. Valeurs à valider :
 * elles protègent les utilisateurs des fautes de frappe, limitent l'exposition et alignent
 * les montants sur les plafonds réglementaires de la monnaie électronique.
 */
import { REFERENCE_RATE, xofForEurCents, type RateMilli, type Side } from "./matching";

/** Écart maximal du taux limite autour du taux de référence, en pourcentage. */
export const RATE_BAND_PCT = 15;

/*
 * Plafonds de montant, en XOF (un montant en euros compte pour son équivalent au taux officiel).
 * Ils suivent les limites de la monnaie électronique fixées par la BCEAO (instruction
 * n° 008-05-2015), puisque les participants reçoivent leurs XOF sur un compte mobile money :
 * solde maximal de 2 000 000 FCFA et rechargements de 10 000 000 FCFA par mois pour un client
 * identifié. À partir du 2 novembre 2026 (instruction n° 020 du 8 octobre 2026), ces limites
 * passent à 4 000 000 et 15 000 000 FCFA : à relever après validation juridique.
 */

/** Montant maximal d'un échange : le solde maximal d'un compte mobile money. */
export const MAX_ORDER_XOF = 2_000_000;

/** Volume maximal par personne et par jour : un compte ne peut pas recevoir davantage dans la journée. */
export const MAX_DAILY_XOF = 2_000_000;

/** Volume maximal par personne et par mois : les rechargements mensuels autorisés. */
export const MAX_MONTHLY_XOF = 10_000_000;

/** Équivalent en XOF d'un montant d'ordre (centimes convertis au taux officiel, arrondi à l'inférieur). */
export function xofEquivalent(side: Side, amount: number): number {
  return side === "SELL_XOF" ? amount : xofForEurCents(amount, REFERENCE_RATE);
}

export interface VolumeUsage {
  /** Volume déjà engagé aujourd'hui et ce mois-ci, en XOF. */
  today: number;
  month: number;
}

/** Ce qu'une personne peut encore échanger, en XOF : le plus contraignant des trois plafonds. */
export function remainingAllowance(usage: VolumeUsage): number {
  return Math.max(0, Math.min(MAX_ORDER_XOF, MAX_DAILY_XOF - usage.today, MAX_MONTHLY_XOF - usage.month));
}

/** Raison du refus si ce nouvel échange dépasse un plafond journalier ou mensuel, sinon null. */
export function checkVolumePolicy(side: Side, amount: number, usage: VolumeUsage): string | null {
  const xof = xofEquivalent(side, amount);
  if (usage.today + xof > MAX_DAILY_XOF) {
    return `Ce montant dépasse votre plafond journalier (${fmt(MAX_DAILY_XOF)} XOF par jour) : il vous reste ${fmt(Math.max(0, MAX_DAILY_XOF - usage.today))} XOF aujourd'hui.`;
  }
  if (usage.month + xof > MAX_MONTHLY_XOF) {
    return `Ce montant dépasse votre plafond mensuel (${fmt(MAX_MONTHLY_XOF)} XOF par mois) : il vous reste ${fmt(Math.max(0, MAX_MONTHLY_XOF - usage.month))} XOF ce mois-ci.`;
  }
  return null;
}

const fmt = (n: number) => n.toLocaleString("fr-FR");

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
    return `Vous avez déjà ${MAX_OPEN_ORDERS} demandes en attente : annulez-en une avant d'en créer une nouvelle.`;
  }
  if (ordersLastHour >= MAX_ORDERS_PER_HOUR) {
    return `Limite de ${MAX_ORDERS_PER_HOUR} échanges par heure atteinte. Réessayez un peu plus tard.`;
  }
  return null;
}

/** Renvoie la raison du refus, ou null si l'ordre respecte les garde-fous. */
/** Bornes du taux limite autorisé, en millièmes : ±RATE_BAND_PCT autour de la référence. */
export function rateBand(): { low: RateMilli; high: RateMilli } {
  return {
    low: Math.ceil((REFERENCE_RATE * (100 - RATE_BAND_PCT)) / 100),
    high: Math.floor((REFERENCE_RATE * (100 + RATE_BAND_PCT)) / 100),
  };
}

export function checkOrderPolicy(side: Side, amount: number, limitRate: RateMilli): string | null {
  const { low, high } = rateBand();
  if (limitRate < low || limitRate > high) {
    return `Taux hors limites : il doit rester à ±${RATE_BAND_PCT} % du taux de référence.`;
  }
  if (xofEquivalent(side, amount) > MAX_ORDER_XOF) {
    return `Montant trop élevé : ${fmt(MAX_ORDER_XOF)} XOF au plus par échange (ou l'équivalent en euros, environ 3 049 €).`;
  }
  return null;
}
