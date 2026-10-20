/**
 * Moteur de matching de liquidité EUR / XOF (prototype).
 *
 * Principes :
 * - Matching fractionné : une demande peut être servie par plusieurs offres.
 * - Carnet d'ordres : une offre partiellement consommée garde son reste.
 * - Montants en unités entières (centimes d'euro, XOF entiers) pour éviter
 *   les erreurs d'arrondi des nombres flottants.
 * - Chaque remplissage s'exécute au taux de l'offre (prix « pay-as-bid »).
 *
 * Convention de taux : XOF par 1 EUR (ex. 655.957).
 *
 * Ce module ne déplace aucun argent. Il calcule seulement des appariements.
 */

/** Taux de référence officiel : 1 EUR = 655,957 XOF (parité fixe). */
export const REFERENCE_RATE_XOF_PER_EUR = 655.957;

export interface SellEurOffer {
  id: string;
  /** Identifiant anonyme de l'utilisateur (jamais de données personnelles ici). */
  ownerId: string;
  /** Montant d'EUR encore disponible, en centimes. */
  eurCentsRemaining: number;
  /** Taux minimum accepté par le vendeur d'EUR (XOF par EUR). */
  minRateXofPerEur: number;
  /** Ordre d'arrivée, sert à départager les taux identiques (premier arrivé, premier servi). */
  seq: number;
}

export interface BuyEurRequest {
  id: string;
  ownerId: string;
  /** Montant de XOF que l'acheteur veut dépenser. */
  xofToSpend: number;
  /** Taux maximum accepté par l'acheteur (XOF par EUR). */
  maxRateXofPerEur: number;
}

export interface Fill {
  offerId: string;
  sellerId: string;
  eurCents: number;
  xofAmount: number;
  rateXofPerEur: number;
}

export interface MatchResult {
  requestId: string;
  fills: Fill[];
  /** XOF effectivement consommés. */
  xofFilled: number;
  /** XOF non servis (la demande reste partiellement ou totalement ouverte). */
  xofUnfilled: number;
  /** Carnet d'ordres après exécution (les offres consommées sont retirées, les partielles réduites). */
  book: SellEurOffer[];
}

/** Montant de centimes d'EUR obtenu pour un montant de XOF au taux donné (arrondi à l'inférieur). */
export function eurCentsForXof(xof: number, rate: number): number {
  return Math.floor((xof * 100) / rate);
}

/** Montant de XOF nécessaire pour acheter un montant de centimes d'EUR au taux donné (arrondi à l'inférieur). */
export function xofForEurCents(eurCents: number, rate: number): number {
  return Math.floor((eurCents * rate) / 100);
}

/**
 * Apparie une demande d'achat d'EUR avec le carnet d'ordres.
 * Stratégie : on consomme d'abord les offres les moins chères (taux minimum le plus bas),
 * puis les plus anciennes à taux égal. On s'arrête quand la demande est servie
 * ou quand il ne reste plus d'offre acceptable au taux maximum demandé.
 *
 * Fonction pure : le carnet d'entrée n'est pas modifié.
 */
export function matchBuyRequest(
  book: readonly SellEurOffer[],
  request: BuyEurRequest,
): MatchResult {
  assertValidRequest(request);

  const candidates = book
    .filter((o) => o.eurCentsRemaining > 0 && o.minRateXofPerEur <= request.maxRateXofPerEur)
    .sort((a, b) => a.minRateXofPerEur - b.minRateXofPerEur || a.seq - b.seq);

  const updated = new Map<string, SellEurOffer>(book.map((o) => [o.id, { ...o }]));
  const fills: Fill[] = [];
  let xofRemaining = request.xofToSpend;

  for (const candidate of candidates) {
    if (xofRemaining <= 0) break;

    const offer = updated.get(candidate.id);
    if (!offer || offer.eurCentsRemaining <= 0) continue;

    const rate = offer.minRateXofPerEur;
    const affordableCents = eurCentsForXof(xofRemaining, rate);
    const eurCents = Math.min(offer.eurCentsRemaining, affordableCents);
    if (eurCents <= 0) continue;

    const xofAmount = xofForEurCents(eurCents, rate);
    // Sécurité : on ne doit jamais dépenser plus que le reste de la demande.
    if (xofAmount > xofRemaining) continue;

    fills.push({
      offerId: offer.id,
      sellerId: offer.ownerId,
      eurCents,
      xofAmount,
      rateXofPerEur: rate,
    });

    offer.eurCentsRemaining -= eurCents;
    xofRemaining -= xofAmount;
  }

  const finalBook = [...updated.values()]
    .filter((o) => o.eurCentsRemaining > 0)
    .sort((a, b) => a.seq - b.seq);

  const xofFilled = request.xofToSpend - xofRemaining;

  return {
    requestId: request.id,
    fills,
    xofFilled,
    xofUnfilled: xofRemaining,
    book: finalBook,
  };
}

/**
 * Applique une marge de change au taux de référence.
 * Exemple : reference 655.957, spread 2 % -> taux client 668.076.
 */
export function applySpread(referenceRate: number, spreadPct: number): number {
  if (spreadPct < 0) throw new RangeError("Le spread ne peut pas être négatif.");
  return referenceRate * (1 + spreadPct / 100);
}

/** Commission dégressive en fonction du montant de XOF (tranches indicatives). */
export function commissionPct(xofAmount: number): number {
  if (xofAmount >= 2_000_000) return 0.3;
  if (xofAmount >= 500_000) return 0.5;
  if (xofAmount >= 100_000) return 0.8;
  return 1;
}

function assertValidRequest(request: BuyEurRequest): void {
  if (!Number.isFinite(request.xofToSpend) || request.xofToSpend <= 0) {
    throw new RangeError("Le montant demandé doit être positif.");
  }
  if (!Number.isFinite(request.maxRateXofPerEur) || request.maxRateXofPerEur <= 0) {
    throw new RangeError("Le taux maximum doit être positif.");
  }
  if (!Number.isInteger(request.xofToSpend)) {
    throw new RangeError("Le montant en XOF doit être un entier.");
  }
}
