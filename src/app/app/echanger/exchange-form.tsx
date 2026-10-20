"use client";

import { useActionState, useState } from "react";
import { averageRate, fmtEur, fmtGiven, fmtPct, fmtRate, fmtReceived, fmtXof, rateGap } from "@/lib/format";
import { eurCentsForXof, parseEurCents, parseRate, parseXof, REFERENCE_RATE, xofForEurCents, type Side } from "@/lib/matching";
import { checkOrderPolicy } from "@/lib/policy";
import { previewOrder, type PublicBookEntry } from "@/lib/preview";
import { placeOrderAction, type ExchangeState } from "./actions";

function attempt<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Saisie invalide" };
  }
}

/** Aperçu sur le carnet actuel, ou la raison pour laquelle l'ordre serait refusé. */
function computePreview(book: PublicBookEntry[], side: Side, amount: number | null, limitRate: number | null) {
  if (amount === null || limitRate === null) return null;
  const refusal = checkOrderPolicy(side, amount, limitRate);
  if (refusal) return { refusal };
  const result = attempt(() => previewOrder(book, { side, amount, limitRate }));
  return result.ok ? { result: result.value } : { refusal: result.error };
}

export function ExchangeForm({ book }: { book: PublicBookEntry[] }) {
  const [state, action, pending] = useActionState<ExchangeState, FormData>(placeOrderAction, {});
  const [side, setSide] = useState<Side>("SELL_XOF");
  const [amounts, setAmounts] = useState<Record<Side, string>>({ SELL_XOF: "", SELL_EUR: "" });
  const [rates, setRates] = useState<Record<Side, string>>({ SELL_XOF: "670", SELL_EUR: "650" });
  const sellXof = side === "SELL_XOF";

  const amount = attempt(() => (sellXof ? parseXof(amounts[side]) : parseEurCents(amounts[side])));
  const rate = attempt(() => parseRate(rates[side]));

  const preview = computePreview(book, side, amount.ok ? amount.value : null, rate.ok ? rate.value : null);

  const refHint = amount.ok
    ? sellXof
      ? `≈ ${fmtEur(eurCentsForXof(amount.value, REFERENCE_RATE))} au taux de référence`
      : `≈ ${fmtXof(xofForEurCents(amount.value, REFERENCE_RATE))} au taux de référence`
    : "";

  return (
    <form action={action} className="exchange">
      <input type="hidden" name="side" value={side} />

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
        <label className="field">
          <span className="field-label">Montant à échanger</span>
          <span className="input-wrap">
            <input name="amount" inputMode={sellXof ? "numeric" : "decimal"} autoComplete="off" value={amounts[side]}
              placeholder={sellXof ? "500 000" : "750"} required
              onChange={(e) => setAmounts((p) => ({ ...p, [side]: e.target.value }))} />
            <span className="suffix">{sellXof ? "XOF" : "€"}</span>
          </span>
          <span className="field-hint">{amounts[side] && !amount.ok ? amount.error : refHint || " "}</span>
        </label>
        <label className="field">
          <span className="field-label">{sellXof ? "Taux maximum que j'accepte" : "Taux minimum que j'accepte"}</span>
          <span className="input-wrap">
            <input name="rate" inputMode="decimal" autoComplete="off" value={rates[side]} required
              onChange={(e) => setRates((p) => ({ ...p, [side]: e.target.value }))} />
            <span className="suffix">XOF / €</span>
          </span>
          <span className="field-hint">{rate.ok ? rateGap(rate.value) : rate.error}</span>
        </label>
      </div>

      <section className="card preview" aria-live="polite" aria-label="Aperçu">
        <div className="card-body">
          {!preview ? (
            <p className="muted" style={{ margin: 0 }}>Saisissez un montant pour voir l&apos;aperçu.</p>
          ) : "refusal" in preview ? (
            <p className="error" style={{ margin: 0 }}>{preview.refusal}</p>
          ) : (
            <PreviewSummary side={side} amount={amount.ok ? amount.value : 0} result={preview.result} />
          )}
        </div>
      </section>

      {state.error && <p className="error" role="alert">{state.error}</p>}

      <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={pending || !preview || "refusal" in preview}>
        {pending ? "Enregistrement…" : "Confirmer l'ordre"}
      </button>
      <p className="field-hint center">
        L&apos;exécution a lieu au moment de la confirmation, au meilleur des offres disponibles à cet
        instant, jamais au-delà de votre taux. Aucun argent ne transite par Mosaik.
      </p>
    </form>
  );
}

function PreviewSummary({ side, amount, result }: { side: Side; amount: number; result: ReturnType<typeof previewOrder> }) {
  const resting = result.resting?.remaining ?? 0;
  const myLeftover = result.closed.find((c) => c.orderId === "apercu")?.amount ?? 0;

  if (result.trades.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        Aucune contrepartie compatible pour l&apos;instant. Votre ordre de <strong>{fmtGiven(side, amount)}</strong>{" "}
        attendra dans le carnet à votre taux, jusqu&apos;à ce que quelqu&apos;un le croise.
      </p>
    );
  }

  return (
    <>
      <div className="hero">
        <div className="stat stat-main">
          <div className="stat-label">Vous recevez tout de suite</div>
          <div className="stat-value">{fmtReceived(side, result.received)}</div>
          <div className="stat-sub">pour {fmtGiven(side, result.given)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Taux moyen</div>
          <div className="stat-value">{fmtRate(averageRate(result.trades))}</div>
          <div className="stat-sub">XOF / €</div>
        </div>
        <div className="stat">
          <div className="stat-label">Servi</div>
          <div className="stat-value">{fmtPct(result.given, amount)}</div>
          <div className="stat-sub">{result.trades.length} contrepartie{result.trades.length > 1 ? "s" : ""}</div>
        </div>
      </div>
      {resting > 0 && (
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Le reste, <strong>{fmtGiven(side, resting)}</strong>, attendra dans le carnet à votre taux.
        </p>
      )}
      {myLeftover > 0 && (
        <p className="warn-text" style={{ margin: "4px 0 0" }}>
          Reste technique : {fmtGiven(side, myLeftover)} restent chez vous (moins d&apos;1 centime d&apos;euro).
        </p>
      )}
    </>
  );
}
