"use client";

import { useMemo, useState } from "react";
import {
  eurCentsForXof,
  matchBuyRequest,
  matchBuyXofRequest,
  REFERENCE_RATE_XOF_PER_EUR,
  type Fill,
  type MatchResult,
  type SellEurOffer,
  type SellXofOffer,
  type XofMatchResult,
  xofForEurCents,
} from "@/lib/matching";

/** Sens de l'échange vu par le demandeur. */
type Direction = "buyEur" | "buyXof";

/** Carnets de départ. Données fictives, aucun utilisateur réel. */
const INITIAL_EUR_BOOK: SellEurOffer[] = [
  { id: "offre-1", ownerId: "vendeur-1", eurCentsRemaining: 80_000, minRateXofPerEur: 655.957, seq: 1 },
  { id: "offre-2", ownerId: "vendeur-2", eurCentsRemaining: 40_000, minRateXofPerEur: 657, seq: 2 },
  { id: "offre-3", ownerId: "vendeur-3", eurCentsRemaining: 25_000, minRateXofPerEur: 660, seq: 3 },
  { id: "offre-4", ownerId: "vendeur-4", eurCentsRemaining: 200_000, minRateXofPerEur: 668, seq: 4 },
];

const INITIAL_XOF_BOOK: SellXofOffer[] = [
  { id: "offre-5", ownerId: "vendeur-5", xofRemaining: 300_000, maxRateXofPerEur: 655.957, seq: 5 },
  { id: "offre-6", ownerId: "vendeur-6", xofRemaining: 500_000, maxRateXofPerEur: 654, seq: 6 },
  { id: "offre-7", ownerId: "vendeur-7", xofRemaining: 200_000, maxRateXofPerEur: 652, seq: 7 },
  { id: "offre-8", ownerId: "vendeur-8", xofRemaining: 1_500_000, maxRateXofPerEur: 645, seq: 8 },
];

const INITIAL_NEXT_SEQ = INITIAL_EUR_BOOK.length + INITIAL_XOF_BOOK.length + 1;

// ---------- Affichage uniquement (les décimales sont permises ici) ----------

const fmtXof = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} XOF`;
const fmtEur = (cents: number) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const fmtRate = (rate: number) => rate.toLocaleString("fr-FR", { maximumFractionDigits: 3 });
/** Part servie, arrondie à l'inférieur : on n'affiche jamais 100 % s'il reste un montant. */
function fmtPct(part: number, total: number): string {
  const pct = Math.floor((part / total) * 1000) / 10;
  return `${pct.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}
/** Conversion d'une saisie en euros vers des centimes entiers (corrige 1.13 * 100 = 112.999…). */
const toCents = (eur: number) => Math.round(eur * 100);

/** Montant dans la devise que le demandeur dépense, ou qu'il reçoit. */
const fmtSpent = (d: Direction, n: number) => (d === "buyEur" ? fmtXof(n) : fmtEur(n));
const fmtReceived = (d: Direction, n: number) => (d === "buyEur" ? fmtEur(n) : fmtXof(n));

/** Équivalent indicatif d'un montant saisi au taux de référence. */
function refEquivalent(d: Direction, amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return d === "buyEur"
    ? `≈ ${fmtEur(eurCentsForXof(Math.floor(amount), REFERENCE_RATE_XOF_PER_EUR))} au taux de référence`
    : `≈ ${fmtXof(xofForEurCents(toCents(amount), REFERENCE_RATE_XOF_PER_EUR))} au taux de référence`;
}

/** Écart d'un taux par rapport à la référence, en pourcentage. */
function rateGap(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "";
  const pct = (rate / REFERENCE_RATE_XOF_PER_EUR - 1) * 100;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} % par rapport à la référence`;
}

/** Une offre de XOF dont le reste ne vaut pas 1 centime à son taux n'est plus appariable. */
const isXofDust = (o: SellXofOffer) => eurCentsForXof(o.xofRemaining, o.maxRateXofPerEur) === 0;

// ---------- Modèle d'affichage commun aux deux sens ----------

interface PreviewView {
  direction: Direction;
  fills: Fill[];
  /** Montants dans la devise dépensée : XOF (achat d'EUR) ou centimes (achat de XOF). */
  total: number;
  spent: number;
  unfilled: number;
  /** Montant reçu : centimes (achat d'EUR) ou XOF (achat de XOF). */
  received: number;
  /** Reste technique en XOF : chez le demandeur (achat d'EUR) ou chez les vendeurs (achat de XOF). */
  roundingXof: number;
  /** Identifiants des offres qui disparaissent du carnet si l'on exécute. */
  consumedIds: Set<string>;
}

type Preview =
  | { ok: true; view: PreviewView; raw: { direction: "buyEur"; value: MatchResult } | { direction: "buyXof"; value: XofMatchResult } }
  | { ok: false; error: string };

function viewOfBuyEur(result: MatchResult, total: number, book: SellEurOffer[]): PreviewView {
  const remaining = new Set(result.book.map((o) => o.id));
  return {
    direction: "buyEur",
    fills: result.fills,
    total,
    spent: result.xofFilled,
    unfilled: result.xofUnfilled,
    received: result.fills.reduce((s, f) => s + f.eurCents, 0),
    roundingXof: result.xofRoundingRemainder,
    consumedIds: new Set(book.filter((o) => !remaining.has(o.id)).map((o) => o.id)),
  };
}

function viewOfBuyXof(result: XofMatchResult, total: number, book: SellXofOffer[]): PreviewView {
  const remaining = new Set(result.book.map((o) => o.id));
  const servedIds = new Set(result.fills.map((f) => f.offerId));
  return {
    direction: "buyXof",
    fills: result.fills,
    total,
    spent: result.eurCentsFilled,
    unfilled: result.eurCentsUnfilled,
    received: result.xofReceived,
    roundingXof: result.book
      .filter((o) => servedIds.has(o.id) && isXofDust(o))
      .reduce((s, o) => s + o.xofRemaining, 0),
    consumedIds: new Set(book.filter((o) => !remaining.has(o.id)).map((o) => o.id)),
  };
}

interface Execution {
  direction: Direction;
  spent: number;
  received: number;
  sellers: number;
}

export function Simulator() {
  const [direction, setDirection] = useState<Direction>("buyEur");
  const [eurBook, setEurBook] = useState<SellEurOffer[]>(INITIAL_EUR_BOOK);
  const [xofBook, setXofBook] = useState<SellXofOffer[]>(INITIAL_XOF_BOOK);
  // Numéro d'ordre unique (partagé par les deux carnets), utilisé pour l'identifiant,
  // le nom et l'ordre d'arrivée.
  const [nextSeq, setNextSeq] = useState(INITIAL_NEXT_SEQ);

  // Demande : achat d'EUR (on dépense des XOF)
  const [xof, setXof] = useState(1_000_000);
  const [maxRate, setMaxRate] = useState(670);
  // Demande : achat de XOF (on dépense des EUR)
  const [eur, setEur] = useState(1000);
  const [minRate, setMinRate] = useState(650);

  // Nouvelle offre : vendre des EUR
  const [offerEur, setOfferEur] = useState(500);
  const [offerMinRate, setOfferMinRate] = useState(660);
  // Nouvelle offre : vendre des XOF
  const [offerXof, setOfferXof] = useState(300_000);
  const [offerMaxRate, setOfferMaxRate] = useState(652);
  const [offerError, setOfferError] = useState<string | null>(null);

  const [lastExecution, setLastExecution] = useState<Execution | null>(null);

  const preview = useMemo<Preview>(() => {
    try {
      if (direction === "buyEur") {
        const total = Math.floor(xof);
        const value = matchBuyRequest(eurBook, {
          id: "demande",
          ownerId: "demandeur",
          xofToSpend: total,
          maxRateXofPerEur: maxRate,
        });
        return { ok: true, view: viewOfBuyEur(value, total, eurBook), raw: { direction, value } };
      }
      const total = toCents(eur);
      const value = matchBuyXofRequest(xofBook, {
        id: "demande",
        ownerId: "demandeur",
        eurCentsToSpend: total,
        minRateXofPerEur: minRate,
      });
      return { ok: true, view: viewOfBuyXof(value, total, xofBook), raw: { direction, value } };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
    }
  }, [direction, eurBook, xofBook, xof, maxRate, eur, minRate]);

  function changeDirection(next: Direction) {
    setDirection(next);
    setOfferError(null);
  }

  function addOffer() {
    if (direction === "buyEur") {
      // Le demandeur achète des EUR : les offres sont des ventes d'EUR.
      const eurCents = toCents(offerEur);
      if (!Number.isFinite(eurCents) || eurCents <= 0) {
        setOfferError("Le montant en EUR doit être positif.");
        return;
      }
      if (!Number.isFinite(offerMinRate) || offerMinRate <= 0) {
        setOfferError("Le taux minimum doit être positif.");
        return;
      }
      setEurBook((prev) => [
        ...prev,
        {
          id: `offre-${nextSeq}`,
          ownerId: `vendeur-${nextSeq}`,
          eurCentsRemaining: eurCents,
          minRateXofPerEur: offerMinRate,
          seq: nextSeq,
        },
      ]);
    } else {
      // Le demandeur achète des XOF : les offres sont des ventes de XOF.
      const xofAmount = Math.floor(offerXof);
      if (!Number.isFinite(xofAmount) || xofAmount <= 0) {
        setOfferError("Le montant en XOF doit être positif.");
        return;
      }
      if (!Number.isFinite(offerMaxRate) || offerMaxRate <= 0) {
        setOfferError("Le taux maximum doit être positif.");
        return;
      }
      setXofBook((prev) => [
        ...prev,
        {
          id: `offre-${nextSeq}`,
          ownerId: `vendeur-${nextSeq}`,
          xofRemaining: xofAmount,
          maxRateXofPerEur: offerMaxRate,
          seq: nextSeq,
        },
      ]);
    }
    setOfferError(null);
    setNextSeq((s) => s + 1);
  }

  function executeRequest() {
    if (!preview.ok) return;
    const { raw, view } = preview;
    if (raw.direction === "buyEur") setEurBook(raw.value.book);
    else setXofBook(raw.value.book);
    setLastExecution({
      direction: view.direction,
      spent: view.spent,
      received: view.received,
      sellers: view.fills.length,
    });
  }

  function resetBooks() {
    setEurBook(INITIAL_EUR_BOOK);
    setXofBook(INITIAL_XOF_BOOK);
    setNextSeq(INITIAL_NEXT_SEQ);
    setLastExecution(null);
  }

  const buyEur = direction === "buyEur";

  return (
    <div className="layout">
      <div className="stack">
        {/* Demande */}
        <section className="card" aria-labelledby="request-title">
          <div className="card-head">
            <h2 id="request-title">Votre demande</h2>
          </div>
          <div className="card-body">
            <div className="segmented" role="group" aria-label="Sens de l'échange">
              <button type="button" aria-pressed={buyEur} onClick={() => changeDirection("buyEur")}>
                <span className="pair">XOF → EUR</span>
                <span className="hint">J&apos;ai des XOF, je veux des euros</span>
              </button>
              <button type="button" aria-pressed={!buyEur} onClick={() => changeDirection("buyXof")}>
                <span className="pair">EUR → XOF</span>
                <span className="hint">J&apos;ai des euros, je veux des XOF</span>
              </button>
            </div>

            <div className="fields">
              {buyEur ? (
                <>
                  <NumberField label="Montant à dépenser" suffix="XOF" value={xof} step={1000} min={1}
                    onChange={setXof} hint={refEquivalent("buyEur", xof)} />
                  <NumberField label="Taux maximum accepté" suffix="XOF / €" value={maxRate} step={0.5} min={1}
                    onChange={setMaxRate} hint={rateGap(maxRate)} />
                </>
              ) : (
                <>
                  <NumberField label="Montant à dépenser" suffix="€" value={eur} step={10} min={0.01}
                    onChange={setEur} hint={refEquivalent("buyXof", eur)} />
                  <NumberField label="Taux minimum accepté" suffix="XOF / €" value={minRate} step={0.5} min={1}
                    onChange={setMinRate} hint={rateGap(minRate)} />
                </>
              )}
            </div>
            {!preview.ok && <p className="error" role="alert">{preview.error}</p>}
          </div>
        </section>

        {/* Exécution proposée */}
        <section className="card" aria-labelledby="result-title">
          <div className="card-head">
            <h2 id="result-title">Exécution proposée</h2>
            {preview.ok && (
              <span className="meta">
                {preview.view.fills.length} vendeur{preview.view.fills.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="card-body">
            {lastExecution && (
              <div className="notice success" role="status" style={{ marginTop: 0, marginBottom: 16 }}>
                <IconCheck />
                <div>
                  <strong>Simulation exécutée.</strong>{" "}
                  {fmtSpent(lastExecution.direction, lastExecution.spent)} échangés contre{" "}
                  {fmtReceived(lastExecution.direction, lastExecution.received)} auprès de{" "}
                  {lastExecution.sellers} vendeur{lastExecution.sellers > 1 ? "s" : ""}. Le carnet a été
                  mis à jour. Aucun paiement réel n&apos;a eu lieu.
                </div>
              </div>
            )}

            {preview.ok ? (
              <ResultView view={preview.view} />
            ) : (
              <p className="empty">Corrigez la demande pour voir l&apos;exécution proposée.</p>
            )}

            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={executeRequest}
                disabled={!preview.ok || preview.view.fills.length === 0}>
                Exécuter la demande
              </button>
              <span className="field-hint">Simulation : le carnet est mis à jour, aucun argent ne bouge.</span>
            </div>
          </div>
        </section>
      </div>

      {/* Carnet d'ordres */}
      <section className="card" aria-labelledby="book-title">
        <div className="card-head stacked">
          <h2 id="book-title">Carnet : {buyEur ? "vendeurs d'euros" : "vendeurs de XOF"}</h2>
          <span className="meta">
            Ordre de passage : taux le plus {buyEur ? "bas" : "élevé"}, puis premier arrivé
          </span>
        </div>
        <div className="card-body">
          <OrderBook
            direction={direction}
            eurBook={eurBook}
            xofBook={xofBook}
            fills={preview.ok ? preview.view.fills : []}
            consumedIds={preview.ok ? preview.view.consumedIds : new Set()}
          />
        </div>
        <div className="card-foot">
          <div className="foot-row">
            <h3>Ajouter une offre {buyEur ? "de vente d'euros" : "de vente de XOF"}</h3>
            <button type="button" className="link-btn" onClick={resetBooks}>
              Réinitialiser la démo
            </button>
          </div>
          <div className="add-offer">
            {buyEur ? (
              <>
                <NumberField label="Montant" suffix="€" value={offerEur} step={10} min={1} onChange={setOfferEur} />
                <NumberField label="Taux minimum" suffix="XOF / €" value={offerMinRate} step={0.5} min={1}
                  onChange={setOfferMinRate} />
              </>
            ) : (
              <>
                <NumberField label="Montant" suffix="XOF" value={offerXof} step={1000} min={1} onChange={setOfferXof} />
                <NumberField label="Taux maximum" suffix="XOF / €" value={offerMaxRate} step={0.5} min={1}
                  onChange={setOfferMaxRate} />
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={addOffer}>Ajouter</button>
          </div>
          {offerError && <p className="error" role="alert">{offerError}</p>}
          <p className="field-hint" style={{ margin: "10px 0 0" }}>
            {buyEur
              ? "Le vendeur reçoit au moins ce nombre de XOF par euro vendu."
              : "Le vendeur donne au plus ce nombre de XOF par euro reçu."}
          </p>
        </div>
      </section>
    </div>
  );
}

function ResultView({ view }: { view: PreviewView }) {
  const { direction, fills, total, spent, unfilled, received, roundingXof } = view;
  const buyEur = direction === "buyEur";

  if (fills.length === 0) {
    return (
      <div className="notice info" style={{ marginTop: 0 }}>
        <IconInfo />
        <div>
          Aucune offre du carnet n&apos;est compatible avec votre taux{" "}
          {buyEur ? "maximum" : "minimum"}. Ajustez le taux ou ajoutez une offre.
        </div>
      </div>
    );
  }

  const xofTotal = fills.reduce((s, f) => s + f.xofAmount, 0);
  const centsTotal = fills.reduce((s, f) => s + f.eurCents, 0);
  const avgRate = centsTotal > 0 ? xofTotal / (centsTotal / 100) : 0;
  // Part de chaque vendeur, mesurée dans la devise dépensée par le demandeur.
  const share = (f: Fill) => (buyEur ? f.xofAmount : f.eurCents);
  // Le non-servi hors reste technique : vrai manque de liquidité.
  const shortfall = buyEur ? unfilled - roundingXof : unfilled;

  return (
    <>
      <div className="hero">
        <div className="stat stat-main">
          <div className="stat-label">Vous recevez</div>
          <div className="stat-value">{fmtReceived(direction, received)}</div>
          <div className="stat-sub">pour {fmtSpent(direction, spent)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Taux moyen obtenu</div>
          <div className="stat-value">{fmtRate(avgRate)}</div>
          <div className="stat-sub">XOF / €</div>
        </div>
        <div className="stat">
          <div className="stat-label">Servi</div>
          <div className="stat-value">{fmtPct(spent, total)}</div>
          <div className="stat-sub">de la demande</div>
        </div>
      </div>

      <div className="alloc" role="img"
        aria-label={`Répartition : ${fills.length} vendeurs servent ${fmtSpent(direction, spent)} sur ${fmtSpent(direction, total)}`}>
        {fills.map((f) => (
          <div key={f.offerId} className="alloc-seg" style={{ flexGrow: share(f), flexBasis: 0 }}
            title={`${f.sellerId} : ${fmtSpent(direction, share(f))} à ${fmtRate(f.rateXofPerEur)} XOF / €`} />
        ))}
        {unfilled > 0 && (
          <div className="alloc-seg rest" style={{ flexGrow: unfilled, flexBasis: 0 }}
            title={`${shortfall > 0 ? "Non servi" : "Reste technique"} : ${fmtSpent(direction, unfilled)}`} />
        )}
      </div>
      <div className="legend">
        <span><i /> Servi par vendeur ({fmtSpent(direction, spent)})</span>
        {unfilled > 0 && (
          <span>
            <i className="rest" /> {shortfall > 0 ? "Non servi" : "Reste technique"} ({fmtSpent(direction, unfilled)})
          </span>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Vendeur</th>
              <th className="r">Vous payez</th>
              <th className="r">Vous recevez</th>
              <th className="r">Taux</th>
            </tr>
          </thead>
          <tbody>
            {fills.map((f) => (
              <tr key={f.offerId}>
                <td><Seller id={f.sellerId} /></td>
                <td className="r">{buyEur ? fmtXof(f.xofAmount) : fmtEur(f.eurCents)}</td>
                <td className="r">{buyEur ? fmtEur(f.eurCents) : fmtXof(f.xofAmount)}</td>
                <td className="r">{fmtRate(f.rateXofPerEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shortfall > 0 && (
        <div className="notice info">
          <IconInfo />
          <div>
            <strong>{fmtSpent(direction, shortfall)} non servis</strong> : il n&apos;y a pas assez
            d&apos;offres compatibles dans le carnet. Ce montant reste chez vous.
          </div>
        </div>
      )}
      {roundingXof > 0 && (
        <div className="notice warn">
          <IconWarn />
          <div>
            <strong>Reste technique : {fmtXof(roundingXof)}</strong>
            {buyEur
              ? " restent chez vous. C'est trop peu pour acheter 1 centime d'euro, ce montant n'est donc pas dépensé."
              : " resteront chez les vendeurs servis. Ce reste vaut moins d'1 centime d'euro à leur taux et ne peut plus être apparié."}
          </div>
        </div>
      )}
    </>
  );
}

interface BookRow {
  id: string;
  ownerId: string;
  /** Montant disponible, dans la devise vendue (centimes ou XOF). */
  amount: number;
  label: string;
  rate: number;
  dust: boolean;
}

function OrderBook({
  direction,
  eurBook,
  xofBook,
  fills,
  consumedIds,
}: {
  direction: Direction;
  eurBook: SellEurOffer[];
  xofBook: SellXofOffer[];
  fills: Fill[];
  consumedIds: Set<string>;
}) {
  const buyEur = direction === "buyEur";
  // Affichage dans l'ordre de passage du moteur.
  const rows: BookRow[] = buyEur
    ? [...eurBook]
        .sort((a, b) => a.minRateXofPerEur - b.minRateXofPerEur || a.seq - b.seq)
        .map((o) => ({
          id: o.id, ownerId: o.ownerId, amount: o.eurCentsRemaining,
          label: fmtEur(o.eurCentsRemaining), rate: o.minRateXofPerEur, dust: false,
        }))
    : [...xofBook]
        .sort((a, b) => b.maxRateXofPerEur - a.maxRateXofPerEur || a.seq - b.seq)
        .map((o) => ({
          id: o.id, ownerId: o.ownerId, amount: o.xofRemaining,
          label: fmtXof(o.xofRemaining), rate: o.maxRateXofPerEur, dust: isXofDust(o),
        }));

  if (rows.length === 0) return <p className="empty">Le carnet est vide. Ajoutez une offre ci-dessous.</p>;

  const max = Math.max(...rows.map((r) => r.amount));
  const matched = new Set(fills.map((f) => f.offerId));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th>Vendeur</th>
            <th className="r">Disponible</th>
            <th className="r">{buyEur ? "Taux min." : "Taux max."}</th>
            <th className="r">Aperçu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className={matched.has(r.id) ? "is-matched" : undefined}>
              <td className="rank col-rank">{i + 1}</td>
              <td><Seller id={r.ownerId} /></td>
              <td className="r">
                {r.label}
                <div className="depth" aria-hidden="true">
                  <div style={{ width: `${(r.amount / max) * 100}%` }} />
                </div>
              </td>
              <td className="r">{fmtRate(r.rate)}</td>
              <td className="r">
                {r.dust ? (
                  <span className="badge dust" title="Vaut moins d'1 centime à ce taux : n'est plus appariable">
                    Reste technique
                  </span>
                ) : matched.has(r.id) ? (
                  <span className="badge matched">{consumedIds.has(r.id) ? "Épuisée" : "Partielle"}</span>
                ) : (
                  <span className="rank">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberField({
  label, suffix, value, onChange, step, min, hint,
}: {
  label: string;
  suffix: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input type="number" inputMode="decimal" value={Number.isNaN(value) ? "" : value} step={step} min={min}
          onChange={(e) => onChange(Number(e.target.value))} />
        <span className="suffix">{suffix}</span>
      </span>
      {hint !== undefined && <span className="field-hint">{hint || " "}</span>}
    </label>
  );
}

function Seller({ id }: { id: string }) {
  const n = id.replace(/\D/g, "") || "?";
  return (
    <span className="seller">
      <span className="avatar" aria-hidden="true">V{n}</span>
      Vendeur {n}
    </span>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8.2l2 2 4-4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.2V11.5M8 4.8v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconWarn() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 1.8l6.6 11.7H1.4L8 1.8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
