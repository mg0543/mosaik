/**
 * Offres disponibles, vues par l'utilisateur qui veut les prendre (onglet Activité).
 * Ses propres offres sont exclues ; les meilleures pour lui viennent en premier.
 */
import { eurCentsForXof, xofForEurCents, type RateMilli, type Side } from "./matching";
import type { PublicBookEntry } from "./preview";

export interface OfferView {
  seq: number;
  /** Montant proposé par l'autre participant, dans sa devise (XOF ou centimes). */
  available: number;
  rate: RateMilli;
  /** Ce que l'utilisateur envoie pour prendre toute l'offre : sens et montant (centimes ou XOF). */
  takerSide: Side;
  takerAmount: number;
}

export function marketOffers(book: readonly PublicBookEntry[], limit = 5): { forXof: OfferView[]; forEur: OfferView[] } {
  const others = book.filter((o) => !o.isMine && o.remaining > 0);
  // Des XOF à obtenir : offres des vendeurs de XOF, le plus de XOF par euro d'abord.
  const forXof = others
    .filter((o) => o.side === "SELL_XOF")
    .sort((a, b) => b.limitRate - a.limitRate || a.seq - b.seq)
    .map((o) => ({ seq: o.seq, available: o.remaining, rate: o.limitRate, takerSide: "SELL_EUR" as const, takerAmount: eurCentsForXof(o.remaining, o.limitRate) }))
    .filter((o) => o.takerAmount > 0)
    .slice(0, limit);
  // Des euros à obtenir : offres des vendeurs d'euros, le moins de XOF par euro d'abord.
  const forEur = others
    .filter((o) => o.side === "SELL_EUR")
    .sort((a, b) => a.limitRate - b.limitRate || a.seq - b.seq)
    .map((o) => ({ seq: o.seq, available: o.remaining, rate: o.limitRate, takerSide: "SELL_XOF" as const, takerAmount: xofForEurCents(o.remaining, o.limitRate) }))
    .filter((o) => o.takerAmount > 0)
    .slice(0, limit);
  return { forXof, forEur };
}
