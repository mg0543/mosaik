import { placeOrder, type PlaceOrderResult, type RateMilli, type Side } from "./matching";

/** Ligne du carnet anonymisé telle que la reçoit le navigateur. */
export interface PublicBookEntry {
  side: Side;
  remaining: number;
  limitRate: RateMilli;
  seq: number;
  /** Vrai si l'ordre appartient à l'utilisateur qui regarde. */
  isMine: boolean;
}

const ME = "moi";

/**
 * Aperçu d'un ordre sur le carnet actuel, avec le même moteur que le serveur. Les ordres de
 * l'utilisateur gardent un propriétaire commun pour que l'interdiction de se servir soi-même
 * s'applique ; les autres reçoivent un propriétaire distinct et anonyme.
 * L'exécution réelle peut différer si le carnet change avant la confirmation, mais jamais
 * au-delà du taux limite.
 */
export function previewOrder(
  book: readonly PublicBookEntry[],
  order: { side: Side; amount: number; limitRate: RateMilli },
): PlaceOrderResult {
  const nextSeq = book.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
  return placeOrder(
    book.map((e) => ({
      id: `carnet-${e.seq}`,
      ownerId: e.isMine ? ME : `autre-${e.seq}`,
      side: e.side,
      remaining: e.remaining,
      limitRate: e.limitRate,
      seq: e.seq,
    })),
    { id: "apercu", ownerId: ME, side: order.side, remaining: order.amount, limitRate: order.limitRate, seq: nextSeq },
  );
}
