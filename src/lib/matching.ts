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
 * Convention de taux : XOF par 1 EUR (ex. 655.957), dans les deux sens.
 *
 * Deux sens d'échange :
 * - Achat d'EUR : le carnet contient des vendeurs d'EUR (SellEurOffer),
 *   la demande dépense des XOF (BuyEurRequest) -> matchBuyRequest.
 * - Achat de XOF : le carnet contient des vendeurs de XOF (SellXofOffer),
 *   la demande dépense des EUR (BuyXofRequest) -> matchBuyXofRequest.
 *
 * Règle d'arrondi commune : le montant pivot est toujours un nombre entier de
 * centimes, et le montant en XOF correspondant vaut xofForEurCents (arrondi à
 * l'inférieur). L'écart d'arrondi est donc toujours inférieur à 1 XOF par
 * remplissage, et le budget du demandeur n'est jamais dépassé.
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
  /**
   * Part de xofUnfilled qui relève de l'arrondi et non d'un manque de liquidité :
   * le reste était trop petit pour acheter 1 centime alors qu'une offre acceptable
   * avait encore des EUR. Vaut 0 ou xofUnfilled (quelques XOF au plus).
   */
  xofRoundingRemainder: number;
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

  // Si une offre acceptable a encore des EUR, le reste n'a pas pu acheter 1 centime :
  // c'est un reste d'arrondi, pas un manque de liquidité.
  const liquidityLeft = candidates.some((c) => (updated.get(c.id)?.eurCentsRemaining ?? 0) > 0);

  return {
    requestId: request.id,
    fills,
    xofFilled,
    xofUnfilled: xofRemaining,
    xofRoundingRemainder: liquidityLeft ? xofRemaining : 0,
    book: finalBook,
  };
}

export interface SellXofOffer {
  id: string;
  /** Identifiant anonyme de l'utilisateur (jamais de données personnelles ici). */
  ownerId: string;
  /** Montant de XOF encore disponible. */
  xofRemaining: number;
  /**
   * Taux maximum accepté par le vendeur de XOF (XOF par EUR) : il donne au plus
   * ce nombre de XOF pour 1 EUR reçu.
   */
  maxRateXofPerEur: number;
  /** Ordre d'arrivée, sert à départager les taux identiques (premier arrivé, premier servi). */
  seq: number;
}

export interface BuyXofRequest {
  id: string;
  ownerId: string;
  /** Montant d'EUR que le demandeur veut dépenser, en centimes. */
  eurCentsToSpend: number;
  /** Taux minimum accepté par le demandeur (XOF par EUR). */
  minRateXofPerEur: number;
}

export interface XofMatchResult {
  requestId: string;
  /** Mêmes champs que pour l'autre sens : sellerId désigne ici le vendeur de XOF. */
  fills: Fill[];
  /** Centimes d'EUR effectivement dépensés. */
  eurCentsFilled: number;
  /** Centimes d'EUR non dépensés (la demande reste partiellement ou totalement ouverte). */
  eurCentsUnfilled: number;
  /** XOF reçus par le demandeur (somme des remplissages). */
  xofReceived: number;
  /**
   * Carnet après exécution. Une offre dont le reste vaut moins d'un centime à son taux
   * (reste technique de quelques XOF) y est conservée : elle n'est plus appariable
   * dans ce sens mais n'est pas masquée.
   */
  book: SellXofOffer[];
}

/**
 * Apparie une demande d'achat de XOF (le demandeur dépense des EUR) avec le carnet
 * des vendeurs de XOF.
 * Stratégie : on consomme d'abord les offres les plus avantageuses pour le demandeur
 * (taux le plus élevé, donc le plus de XOF par EUR), puis les plus anciennes à taux égal.
 * Chaque remplissage s'exécute au taux de l'offre.
 *
 * Arrondi : on choisit un nombre entier de centimes, puis le XOF livré vaut
 * xofForEurCents(centimes, taux), arrondi à l'inférieur. Le vendeur de XOF ne donne
 * donc jamais plus que son taux, et le demandeur ne dépense jamais plus que son budget.
 *
 * Fonction pure : le carnet d'entrée n'est pas modifié.
 */
export function matchBuyXofRequest(
  book: readonly SellXofOffer[],
  request: BuyXofRequest,
): XofMatchResult {
  assertValidXofRequest(request);

  const candidates = book
    .filter((o) => o.xofRemaining > 0 && o.maxRateXofPerEur >= request.minRateXofPerEur)
    .sort((a, b) => b.maxRateXofPerEur - a.maxRateXofPerEur || a.seq - b.seq);

  const updated = new Map<string, SellXofOffer>(book.map((o) => [o.id, { ...o }]));
  const fills: Fill[] = [];
  let centsRemaining = request.eurCentsToSpend;

  for (const candidate of candidates) {
    if (centsRemaining <= 0) break;

    const offer = updated.get(candidate.id);
    if (!offer || offer.xofRemaining <= 0) continue;

    const rate = offer.maxRateXofPerEur;
    // Nombre maximal de centimes que l'offre peut honorer sans dépasser son stock de XOF.
    const offerCapacityCents = eurCentsForXof(offer.xofRemaining, rate);
    const eurCents = Math.min(centsRemaining, offerCapacityCents);
    if (eurCents <= 0) continue;

    const xofAmount = xofForEurCents(eurCents, rate);
    // Sécurité : le vendeur ne doit jamais livrer plus que son stock.
    if (xofAmount <= 0 || xofAmount > offer.xofRemaining) continue;

    fills.push({
      offerId: offer.id,
      sellerId: offer.ownerId,
      eurCents,
      xofAmount,
      rateXofPerEur: rate,
    });

    offer.xofRemaining -= xofAmount;
    centsRemaining -= eurCents;
  }

  const finalBook = [...updated.values()]
    .filter((o) => o.xofRemaining > 0)
    .sort((a, b) => a.seq - b.seq);

  return {
    requestId: request.id,
    fills,
    eurCentsFilled: request.eurCentsToSpend - centsRemaining,
    eurCentsUnfilled: centsRemaining,
    xofReceived: fills.reduce((sum, f) => sum + f.xofAmount, 0),
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

function assertValidXofRequest(request: BuyXofRequest): void {
  if (!Number.isFinite(request.eurCentsToSpend) || request.eurCentsToSpend <= 0) {
    throw new RangeError("Le montant demandé doit être positif.");
  }
  if (!Number.isFinite(request.minRateXofPerEur) || request.minRateXofPerEur <= 0) {
    throw new RangeError("Le taux minimum doit être positif.");
  }
  if (!Number.isInteger(request.eurCentsToSpend)) {
    throw new RangeError("Le montant en EUR doit être un nombre entier de centimes.");
  }
}
