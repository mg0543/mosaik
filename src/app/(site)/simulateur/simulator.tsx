"use client";

import { useMemo, useState } from "react";
import {
  eurCentsForXof,
  parseEurCents,
  parseRate,
  parseXof,
  placeOrder,
  REFERENCE_RATE,
  xofForEurCents,
  type Order,
  type PlaceOrderResult,
  type Side,
  type Trade,
} from "@/lib/matching";
import { averageRate, fmtEur, fmtGiven, fmtPct, fmtRate, fmtReceived, fmtXof, rateGap } from "@/lib/format";

/** Identifiant de l'utilisateur du simulateur. */
const ME = "vous";

/** Carnet de départ à deux côtés. Données fictives, aucun utilisateur réel. */
const INITIAL_BOOK: Order[] = [
  { id: "o1", ownerId: "vendeur-1", side: "SELL_EUR", remaining: 80_000, limitRate: 655_957, seq: 1 },
  { id: "o2", ownerId: "vendeur-2", side: "SELL_EUR", remaining: 40_000, limitRate: 657_000, seq: 2 },
  { id: "o3", ownerId: "vendeur-3", side: "SELL_EUR", remaining: 25_000, limitRate: 660_000, seq: 3 },
  { id: "o4", ownerId: "vendeur-4", side: "SELL_EUR", remaining: 200_000, limitRate: 668_000, seq: 4 },
  { id: "o5", ownerId: "vendeur-5", side: "SELL_XOF", remaining: 300_000, limitRate: 655_957, seq: 5 },
  { id: "o6", ownerId: "vendeur-6", side: "SELL_XOF", remaining: 500_000, limitRate: 654_000, seq: 6 },
  { id: "o7", ownerId: "vendeur-7", side: "SELL_XOF", remaining: 200_000, limitRate: 652_000, seq: 7 },
  { id: "o8", ownerId: "vendeur-8", side: "SELL_XOF", remaining: 1_500_000, limitRate: 645_000, seq: 8 },
];

const INITIAL_NEXT_SEQ = INITIAL_BOOK.length + 1;

const sellerLabel = (ownerId: string) => (ownerId === ME ? "Vous" : `Vendeur ${ownerId.replace(/\D/g, "")}`);

/** Lecture d'une saisie : renvoie la valeur ou le message d'erreur. */
function read<T>(parse: (s: string) => T, input: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: parse(input) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Saisie invalide" };
  }
}

const parseAmount = (side: Side) => (side === "SELL_XOF" ? parseXof : parseEurCents);

type Preview = { ok: true; order: Order; result: PlaceOrderResult } | { ok: false; error: string };


export function Simulator() {
  const [book, setBook] = useState<Order[]>(INITIAL_BOOK);
  const [nextSeq, setNextSeq] = useState(INITIAL_NEXT_SEQ);

  // Votre ordre. SELL_XOF : vous avez des XOF et voulez des EUR.
  const [side, setSide] = useState<Side>("SELL_XOF");
  const [xofInput, setXofInput] = useState("1 000 000");
  const [maxRateInput, setMaxRateInput] = useState("670");
  const [eurInput, setEurInput] = useState("1 000");
  const [minRateInput, setMinRateInput] = useState("650");

  // Ordre d'un autre participant (démo), du côté opposé au vôtre.
  const [otherAmount, setOtherAmount] = useState<Record<Side, string>>({ SELL_EUR: "500", SELL_XOF: "300 000" });
  const [otherRate, setOtherRate] = useState<Record<Side, string>>({ SELL_EUR: "660", SELL_XOF: "652" });
  const [otherError, setOtherError] = useState<string | null>(null);

  // Dernier événement concernant vos ordres (exécution ou croisement par un autre participant).
  const [notice, setNotice] = useState<string | null>(null);

  const sellXof = side === "SELL_XOF";
  const counterSide: Side = sellXof ? "SELL_EUR" : "SELL_XOF";
  const amountInput = sellXof ? xofInput : eurInput;
  const rateInput = sellXof ? maxRateInput : minRateInput;
  const parsedRate = read(parseRate, rateInput);
  const parsedAmount = read(parseAmount(side), amountInput);

  const preview = useMemo<Preview>(() => {
    const amount = read(parseAmount(side), amountInput);
    if (!amount.ok) return amount;
    const rate = read(parseRate, rateInput);
    if (!rate.ok) return rate;
    const order: Order = { id: `o${nextSeq}`, ownerId: ME, side, remaining: amount.value, limitRate: rate.value, seq: nextSeq };
    try {
      return { ok: true, order, result: placeOrder(book, order) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
    }
  }, [book, side, amountInput, rateInput, nextSeq]);

  function executeOrder() {
    if (!preview.ok) return;
    const { result } = preview;
    setBook(result.book);
    setNextSeq((s) => s + 1);
    const resting = result.resting?.remaining ?? 0;
    setNotice(
      (result.trades.length > 0
        ? `${fmtGiven(side, result.given)} échangés contre ${fmtReceived(side, result.received)}. `
        : "Aucun échange immédiat. ") +
        (resting > 0 ? `${fmtGiven(side, resting)} attendent dans le carnet. ` : ""),
    );
  }

  function addOtherOrder() {
    const amount = read(parseAmount(counterSide), otherAmount[counterSide]);
    if (!amount.ok) return setOtherError(amount.error);
    const rate = read(parseRate, otherRate[counterSide]);
    if (!rate.ok) return setOtherError(rate.error);
    try {
      const result = placeOrder(book, {
        id: `o${nextSeq}`,
        ownerId: `vendeur-${nextSeq}`,
        side: counterSide,
        remaining: amount.value,
        limitRate: rate.value,
        seq: nextSeq,
      });
      setBook(result.book);
      setNextSeq((s) => s + 1);
      setOtherError(null);
      // Si l'ordre ajouté croise un de vos ordres en attente, on vous le dit.
      const mine = result.trades.filter((t) => t.makerId === ME);
      if (mine.length > 0) {
        const mySide: Side = counterSide === "SELL_EUR" ? "SELL_XOF" : "SELL_EUR";
        const given = mine.reduce((s, t) => s + (mySide === "SELL_XOF" ? t.xof : t.eurCents), 0);
        const received = mine.reduce((s, t) => s + (mySide === "SELL_XOF" ? t.eurCents : t.xof), 0);
        const stillWaiting = result.book.some((o) => o.ownerId === ME);
        const leftover = result.closed.filter((c) => c.ownerId === ME).reduce((s, c) => s + c.amount, 0);
        setNotice(
          `Un autre participant a croisé votre ordre en attente : ${fmtGiven(mySide, given)} échangés contre ` +
            `${fmtReceived(mySide, received)}, à votre taux. ` +
            (stillWaiting ? "Le reste attend toujours dans le carnet. " : "Votre ordre est clôturé. ") +
            (leftover > 0 ? `Reste technique de ${fmtGiven(mySide, leftover)} conservé par vous (moins d'1 centime). ` : ""),
        );
      } else {
        setNotice(null);
      }
    } catch (e) {
      setOtherError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  function resetBook() {
    setBook(INITIAL_BOOK);
    setNextSeq(INITIAL_NEXT_SEQ);
    setNotice(null);
  }

  const refHint = parsedAmount.ok
    ? sellXof
      ? `≈ ${fmtEur(eurCentsForXof(parsedAmount.value, REFERENCE_RATE))} au taux de référence`
      : `≈ ${fmtXof(xofForEurCents(parsedAmount.value, REFERENCE_RATE))} au taux de référence`
    : "";

  const myResting = book.filter((o) => o.ownerId === ME);

  return (
    <div className="layout">
      <div className="stack">
        {/* Ordre */}
        <section className="card" aria-labelledby="request-title">
          <div className="card-head">
            <h2 id="request-title">Votre ordre</h2>
          </div>
          <div className="card-body">
            <div className="segmented" role="group" aria-label="Sens de l'échange">
              <button type="button" aria-pressed={sellXof} onClick={() => setSide("SELL_XOF")}>
                <span className="pair">XOF → EUR</span>
                <span className="hint">J&apos;ai des XOF, je veux des euros</span>
              </button>
              <button type="button" aria-pressed={!sellXof} onClick={() => setSide("SELL_EUR")}>
                <span className="pair">EUR → XOF</span>
                <span className="hint">J&apos;ai des euros, je veux des XOF</span>
              </button>
            </div>

            <div className="fields">
              <TextField label="Montant à échanger" suffix={sellXof ? "XOF" : "€"} value={amountInput}
                onChange={sellXof ? setXofInput : setEurInput} hint={refHint} />
              <TextField label={sellXof ? "Taux maximum accepté" : "Taux minimum accepté"} suffix="XOF / €"
                value={rateInput} onChange={sellXof ? setMaxRateInput : setMinRateInput}
                hint={parsedRate.ok ? rateGap(parsedRate.value) : ""} />
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
                {preview.result.trades.length} contrepartie{preview.result.trades.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="card-body">
            {notice && (
              <div className="notice success" role="status" style={{ marginTop: 0, marginBottom: 16 }}>
                <IconCheck />
                <div>
                  <strong>Simulation.</strong> {notice}Aucun paiement réel n&apos;a eu lieu.
                </div>
              </div>
            )}

            {preview.ok ? (
              <ResultView order={preview.order} result={preview.result} />
            ) : (
              <p className="empty">Corrigez l&apos;ordre pour voir l&apos;exécution proposée.</p>
            )}

            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={executeOrder} disabled={!preview.ok}>
                Passer l&apos;ordre
              </button>
              <span className="field-hint">Simulation : le carnet est mis à jour, aucun argent ne bouge.</span>
            </div>
          </div>
        </section>
      </div>

      {/* Carnet */}
      <section className="card" aria-labelledby="book-title">
        <div className="card-head stacked">
          <h2 id="book-title">Contreparties : {sellXof ? "vendeurs d'euros" : "vendeurs de XOF"}</h2>
          <span className="meta">
            Ordre de passage : taux le plus {sellXof ? "bas" : "élevé"}, puis premier arrivé
          </span>
        </div>
        <div className="card-body">
          <BookTable side={counterSide} book={book} trades={preview.ok ? preview.result.trades : []}
            nextBook={preview.ok ? preview.result.book : book} />

          {myResting.length > 0 && (
            <>
              <h3 className="subhead">Vos ordres en attente</h3>
              <ul className="plain-list">
                {myResting.map((o) => (
                  <li key={o.id}>
                    {o.side === "SELL_XOF" ? "XOF → EUR" : "EUR → XOF"} :{" "}
                    <strong className="num">{fmtGiven(o.side, o.remaining)}</strong>,{" "}
                    {o.side === "SELL_XOF" ? "au plus" : "au moins"} {fmtRate(o.limitRate)} XOF / €
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="card-foot">
          <div className="foot-row">
            <h3>Ajouter l&apos;ordre d&apos;un autre participant</h3>
            <button type="button" className="link-btn" onClick={resetBook}>Réinitialiser la démo</button>
          </div>
          <div className="add-offer">
            <TextField label="Montant" suffix={counterSide === "SELL_EUR" ? "€" : "XOF"} value={otherAmount[counterSide]}
              onChange={(v) => setOtherAmount((p) => ({ ...p, [counterSide]: v }))} />
            <TextField label={counterSide === "SELL_EUR" ? "Taux minimum" : "Taux maximum"} suffix="XOF / €"
              value={otherRate[counterSide]} onChange={(v) => setOtherRate((p) => ({ ...p, [counterSide]: v }))} />
            <button type="button" className="btn btn-secondary" onClick={addOtherOrder}>Ajouter</button>
          </div>
          {otherError && <p className="error" role="alert">{otherError}</p>}
          <p className="field-hint" style={{ margin: "10px 0 0" }}>
            {counterSide === "SELL_EUR"
              ? "Vend des euros et reçoit au moins ce nombre de XOF par euro."
              : "Vend des XOF et donne au plus ce nombre de XOF par euro."}{" "}
            S&apos;il croise un de vos ordres en attente, l&apos;échange a lieu tout de suite.
          </p>
        </div>
      </section>
    </div>
  );
}

function ResultView({ order, result }: { order: Order; result: PlaceOrderResult }) {
  const { trades, given, received, resting, closed } = result;
  const side = order.side;
  const myLeftover = closed.find((c) => c.orderId === order.id)?.amount ?? 0;
  const sellersLeftover = closed.filter((c) => c.orderId !== order.id).reduce((s, c) => s + c.amount, 0);
  const restingAmount = resting?.remaining ?? 0;
  // Part de chaque contrepartie, mesurée dans la devise que vous donnez.
  const share = (t: Trade) => (side === "SELL_XOF" ? t.xof : t.eurCents);

  const avgRate = averageRate(trades);

  return (
    <>
      {trades.length === 0 ? (
        <div className="notice info" style={{ marginTop: 0 }}>
          <IconInfo />
          <div>
            Aucune contrepartie compatible pour l&apos;instant. Votre ordre attendra dans le carnet à
            votre taux limite jusqu&apos;à ce qu&apos;un participant le croise.
          </div>
        </div>
      ) : (
        <>
          <div className="hero">
            <div className="stat stat-main">
              <div className="stat-label">Vous recevez</div>
              <div className="stat-value">{fmtReceived(side, received)}</div>
              <div className="stat-sub">pour {fmtGiven(side, given)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Taux moyen obtenu</div>
              <div className="stat-value">{fmtRate(avgRate)}</div>
              <div className="stat-sub">XOF / €</div>
            </div>
            <div className="stat">
              <div className="stat-label">Servi tout de suite</div>
              <div className="stat-value">{fmtPct(given, order.remaining)}</div>
              <div className="stat-sub">de l&apos;ordre</div>
            </div>
          </div>

          <div className="alloc" role="img"
            aria-label={`Répartition : ${trades.length} contreparties servent ${fmtGiven(side, given)} sur ${fmtGiven(side, order.remaining)}`}>
            {trades.map((t) => (
              <div key={t.makerOrderId} className="alloc-seg" style={{ flexGrow: share(t), flexBasis: 0 }}
                title={`${sellerLabel(t.makerId)} : ${fmtGiven(side, share(t))} à ${fmtRate(t.rate)} XOF / €`} />
            ))}
            {order.remaining - given > 0 && (
              <div className="alloc-seg rest" style={{ flexGrow: order.remaining - given, flexBasis: 0 }}
                title={`${restingAmount > 0 ? "En attente" : "Reste technique"} : ${fmtGiven(side, order.remaining - given)}`} />
            )}
          </div>
          <div className="legend">
            <span><i /> Servi par contrepartie ({fmtGiven(side, given)})</span>
            {restingAmount > 0 && <span><i className="rest" /> En attente ({fmtGiven(side, restingAmount)})</span>}
            {myLeftover > 0 && <span><i className="rest" /> Reste technique ({fmtGiven(side, myLeftover)})</span>}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contrepartie</th>
                  <th className="r">Vous donnez</th>
                  <th className="r">Vous recevez</th>
                  <th className="r">Taux</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.makerOrderId}>
                    <td><Seller ownerId={t.makerId} /></td>
                    <td className="r">{side === "SELL_XOF" ? fmtXof(t.xof) : fmtEur(t.eurCents)}</td>
                    <td className="r">{side === "SELL_XOF" ? fmtEur(t.eurCents) : fmtXof(t.xof)}</td>
                    <td className="r">{fmtRate(t.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {restingAmount > 0 && trades.length > 0 && (
        <div className="notice info">
          <IconInfo />
          <div>
            <strong>{fmtGiven(side, restingAmount)} en attente</strong> : pas assez de contreparties
            compatibles. Ce reste sera inscrit au carnet à votre taux limite.
          </div>
        </div>
      )}
      {myLeftover > 0 && (
        <div className="notice warn">
          <IconWarn />
          <div>
            <strong>Reste technique : {fmtGiven(side, myLeftover)}</strong> restent chez vous. Ce montant
            vaut moins d&apos;1 centime d&apos;euro : il ne peut pas être échangé et votre ordre est clôturé.
          </div>
        </div>
      )}
      {sellersLeftover > 0 && (
        <div className="notice warn">
          <IconWarn />
          <div>
            <strong>Reste technique : {fmtXof(sellersLeftover)}</strong> resteront chez les contreparties
            servies. Ce reste vaut moins d&apos;1 centime d&apos;euro à leur taux : leurs ordres sont clôturés.
          </div>
        </div>
      )}
    </>
  );
}

function BookTable({ side, book, trades, nextBook }: { side: Side; book: Order[]; trades: Trade[]; nextBook: Order[] }) {
  const rows = book
    .filter((o) => o.side === side)
    .sort((a, b) =>
      side === "SELL_EUR" ? a.limitRate - b.limitRate || a.seq - b.seq : b.limitRate - a.limitRate || a.seq - b.seq,
    );
  if (rows.length === 0) return <p className="empty">Aucune contrepartie de ce côté. Ajoutez un ordre ci-dessous.</p>;

  const max = Math.max(...rows.map((r) => r.remaining));
  const matched = new Set(trades.map((t) => t.makerOrderId));
  const stillThere = new Set(nextBook.map((o) => o.id));

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="col-rank">#</th>
            <th>Vendeur</th>
            <th className="r">Disponible</th>
            <th className="r">{side === "SELL_EUR" ? "Taux min." : "Taux max."}</th>
            <th className="r">Aperçu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o, i) => (
            <tr key={o.id} className={matched.has(o.id) ? "is-matched" : undefined}>
              <td className="rank col-rank">{i + 1}</td>
              <td><Seller ownerId={o.ownerId} /></td>
              <td className="r">
                {fmtGiven(side, o.remaining)}
                <div className="depth" aria-hidden="true">
                  <div style={{ width: `${(o.remaining / max) * 100}%` }} />
                </div>
              </td>
              <td className="r">{fmtRate(o.limitRate)}</td>
              <td className="r">
                {matched.has(o.id) ? (
                  <span className="badge matched">{stillThere.has(o.id) ? "Partielle" : "Servie"}</span>
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

function TextField({
  label, suffix, value, onChange, hint,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="input-wrap">
        <input type="text" inputMode="decimal" autoComplete="off" value={value}
          onChange={(e) => onChange(e.target.value)} />
        <span className="suffix">{suffix}</span>
      </span>
      {hint !== undefined && <span className="field-hint">{hint || " "}</span>}
    </label>
  );
}

function Seller({ ownerId }: { ownerId: string }) {
  const n = ownerId.replace(/\D/g, "");
  return (
    <span className="seller">
      <span className="avatar" aria-hidden="true">{ownerId === ME ? "V" : `V${n}`}</span>
      {sellerLabel(ownerId)}
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
