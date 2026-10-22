/**
 * Devis du convertisseur : l'utilisateur indique seulement combien il envoie ; MEYA choisit
 * le taux limite pour lui.
 *
 * - S'il y a assez d'offres, on prend les meilleures et le taux limite est celui de la dernière
 *   offre utilisée : à la confirmation, le résultat ne peut pas être moins bon que l'aperçu.
 * - S'il n'y en a pas assez, ce qui reste attend une offre au taux officiel (655,957 XOF/€),
 *   ou au taux de la dernière offre utilisée s'il est moins favorable, pour que les offres
 *   prises restent compatibles.
 */
import { eurCentsForXof, REFERENCE_RATE, xofForEurCents, type PlaceOrderResult, type RateMilli, type Side } from "./matching";
import { rateBand } from "./policy";
import { previewOrder, type PublicBookEntry } from "./preview";

export interface Quote {
  /** Taux limite choisi automatiquement. */
  limitRate: RateMilli;
  /** Résultat de l'appariement immédiat au taux choisi. */
  result: PlaceOrderResult;
  /** Vrai si tout le montant est servi tout de suite. */
  fullyMatched: boolean;
  /** Ce qui attendra une offre (devise envoyée), 0 si tout est servi. */
  waiting: number;
  /** Ce que recevra la partie en attente si elle est servie au taux choisi (devise reçue). */
  waitingWouldReceive: number;
  /** Total estimé reçu : immédiatement + partie en attente au taux choisi. */
  totalEstimate: number;
}

export function quote(book: readonly PublicBookEntry[], side: Side, amount: number): Quote {
  const sellXof = side === "SELL_XOF";
  const { low, high } = rateBand();

  // 1. Meilleures offres disponibles, sans contrainte de taux au-delà des garde-fous.
  const open = previewOrder(book, { side, amount, limitRate: sellXof ? high : low });
  const rates = open.trades.map((t) => t.rate);
  const worst = rates.length === 0 ? null : sellXof ? Math.max(...rates) : Math.min(...rates);

  // 2. Taux limite : la dernière offre utilisée si tout est servi, sinon le taux officiel
  //    (ou la dernière offre utilisée, si elle est moins favorable que le taux officiel).
  const fullyServed = open.resting === null;
  let limitRate: RateMilli;
  if (fullyServed && worst !== null) limitRate = worst;
  else if (worst === null) limitRate = REFERENCE_RATE;
  else limitRate = sellXof ? Math.max(worst, REFERENCE_RATE) : Math.min(worst, REFERENCE_RATE);

  const result = previewOrder(book, { side, amount, limitRate });
  const waiting = result.resting?.remaining ?? 0;
  const waitingWouldReceive = sellXof ? eurCentsForXof(waiting, limitRate) : xofForEurCents(waiting, limitRate);
  return {
    limitRate,
    result,
    fullyMatched: waiting === 0 && result.trades.length > 0,
    waiting,
    waitingWouldReceive,
    totalEstimate: result.received + waitingWouldReceive,
  };
}
