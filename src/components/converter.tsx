"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrderAction, type ExchangeState } from "@/app/app/echanger/actions";
import { averageRate, fmtEur, fmtEurNumber, fmtRate, fmtXof, fmtXofNumber } from "@/lib/format";
import { eurCentsForXof, parseEurCents, parseRate, parseXof, REFERENCE_RATE, xofForEurCents, type Side } from "@/lib/matching";
import { checkOrderPolicy, checkVolumePolicy, MAX_MONTHLY_XOF, MAX_ORDER_XOF, remainingAllowance, type VolumeUsage } from "@/lib/policy";
import { previewOrder, type PublicBookEntry } from "@/lib/preview";
import { quote } from "@/lib/quote";

/**
 * Convertisseur MEYA : on indique combien on envoie, on voit ce qu'on reçoit au meilleur taux
 * disponible. Le taux limite est choisi automatiquement (voir lib/quote.ts) ; les options
 * avancées permettent de fixer le sien.
 * - mode « public » : estimation sur l'accueil, le bouton mène à l'inscription ;
 * - mode « app » : le bouton enregistre l'échange.
 */
interface Props {
  book: PublicBookEntry[];
  mode: "public" | "app";
  /** Mode app : l'utilisateur peut-il être payé dans la devise qu'il recevrait ? */
  canReceive?: Record<Side, boolean>;
  /** Mode app : volume déjà engagé aujourd'hui et ce mois-ci, pour appliquer les plafonds. */
  usage?: VolumeUsage;
}

type Estimate =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      limitRate: number;
      receivedNow: number;
      total: number;
      partners: number;
      waiting: number;
      displayRate: number;
      custom: boolean;
    };

function estimate(book: PublicBookEntry[], side: Side, amountInput: string, customRate: string, usage?: VolumeUsage): Estimate {
  if (amountInput.trim() === "") return { kind: "empty" };
  let amount: number;
  try {
    amount = side === "SELL_XOF" ? parseXof(amountInput) : parseEurCents(amountInput);
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Montant invalide." };
  }
  // Plafond par échange d'abord (message le plus parlant), puis plafonds du jour et du mois.
  const overSingle = checkOrderPolicy(side, amount, REFERENCE_RATE);
  if (overSingle) return { kind: "error", message: overSingle };
  if (usage) {
    const overVolume = checkVolumePolicy(side, amount, usage);
    if (overVolume) return { kind: "error", message: overVolume };
  }
  try {
    if (customRate.trim() !== "") {
      const limitRate = parseRate(customRate);
      const refusal = checkOrderPolicy(side, amount, limitRate);
      if (refusal) return { kind: "error", message: refusal };
      const r = previewOrder(book, { side, amount, limitRate });
      const waiting = r.resting?.remaining ?? 0;
      const waitingReceives = side === "SELL_XOF" ? eurCentsForXof(waiting, limitRate) : xofForEurCents(waiting, limitRate);
      return {
        kind: "ok", limitRate, receivedNow: r.received, total: r.received + waitingReceives, partners: r.trades.length,
        waiting, displayRate: r.trades.length > 0 ? averageRate(r.trades) : limitRate, custom: true,
      };
    }
    // Le montant est contrôlé au taux officiel ; le taux choisi ensuite reste dans les garde-fous.
    const refusal = checkOrderPolicy(side, amount, REFERENCE_RATE);
    if (refusal) return { kind: "error", message: refusal };
    const q = quote(book, side, amount);
    return {
      kind: "ok", limitRate: q.limitRate, receivedNow: q.result.received, total: q.totalEstimate,
      partners: q.result.trades.length, waiting: q.waiting,
      displayRate: q.result.trades.length > 0 ? averageRate(q.result.trades) : q.limitRate, custom: false,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Estimation impossible." };
  }
}

export function Converter({ book, mode, canReceive, usage }: Props) {
  const [state, action, pending] = useActionState<ExchangeState, FormData>(placeOrderAction, {});
  const [side, setSide] = useState<Side>("SELL_EUR");
  const [amounts, setAmounts] = useState<Record<Side, string>>({ SELL_EUR: "500", SELL_XOF: "300 000" });
  const [customRate, setCustomRate] = useState("");
  const sendEur = side === "SELL_EUR";
  const amountInput = amounts[side];
  const est = estimate(book, side, amountInput, customRate, usage);
  const money = (receiving: boolean, n: number) => ((sendEur ? !receiving : receiving) ? fmtEur(n) : fmtXof(n));
  const missingDetails = mode === "app" && canReceive !== undefined && !canReceive[side];

  function switchSide(next: Side) {
    setSide(next);
    setCustomRate("");
  }

  return (
    <form action={action} className="converter" aria-label="Convertisseur">
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="amount" value={amountInput} />
      <input type="hidden" name="rate" value={est.kind === "ok" ? fmtRate(est.limitRate) : ""} />

      <div className="direction" role="group" aria-label="Ce que vous envoyez">
        <button type="button" aria-pressed={sendEur} onClick={() => switchSide("SELL_EUR")}>J&apos;envoie des euros</button>
        <button type="button" aria-pressed={!sendEur} onClick={() => switchSide("SELL_XOF")}>J&apos;envoie des francs CFA</button>
      </div>

      <label className="money-field">
        <span className="money-label">Vous envoyez</span>
        <span className="money-row">
          <input inputMode={sendEur ? "decimal" : "numeric"} autoComplete="off" aria-label="Montant envoyé"
            value={amountInput} onChange={(e) => setAmounts((p) => ({ ...p, [side]: e.target.value }))} />
          <span className={`currency ${sendEur ? "eur" : "xof"}`}>{sendEur ? "EUR" : "XOF"}</span>
        </span>
      </label>

      <div className="swap-row">
        <button type="button" className="swap" onClick={() => switchSide(sendEur ? "SELL_XOF" : "SELL_EUR")}
          aria-label="Inverser le sens de l'échange">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></svg>
        </button>
      </div>

      <div className="money-field received" aria-live="polite">
        <span className="money-label">{est.kind === "ok" && est.waiting > 0 ? "Vous recevrez environ" : "Vous recevez"}</span>
        <span className="money-row">
          <output className="money-out num" aria-label="Montant reçu">
            {est.kind !== "ok" ? "—" : sendEur ? fmtXofNumber(est.total) : fmtEurNumber(est.total)}
          </output>
          <span className={`currency ${sendEur ? "xof" : "eur"}`}>{sendEur ? "XOF" : "EUR"}</span>
        </span>
      </div>

      {est.kind === "error" && <p className="error" role="alert" style={{ margin: 0 }}>{est.message}</p>}

      {est.kind === "ok" && (
        <ul className="quote-facts">
          <li><span>Taux</span><strong className="num">1 € = {fmtRate(est.displayRate)} XOF</strong></li>
          <li><span>Frais MEYA</span><strong>0 pendant le pilote</strong></li>
          <li className={est.waiting === 0 ? "ok" : "pending"}>
            {est.waiting === 0
              ? `Disponible maintenant : ${est.partners} partenaire${est.partners > 1 ? "s" : ""} prêt${est.partners > 1 ? "s" : ""} à échanger.`
              : est.partners > 0
                ? `${money(true, est.receivedNow)} tout de suite ; le reste (${money(false, est.waiting)}) dès qu'un partenaire accepte le taux de ${fmtRate(est.limitRate)}.`
                : `Aucun partenaire disponible à l'instant : votre demande sera publiée au taux de ${fmtRate(est.limitRate)} et servie dès qu'une personne correspond.`}
          </li>
        </ul>
      )}

      {missingDetails && (
        <div className="notice warn" role="note" style={{ marginTop: 0 }}>
          <div>
            Pour recevoir des {sendEur ? "francs CFA" : "euros"}, indiquez d&apos;abord{" "}
            {sendEur ? "votre numéro mobile money" : "votre IBAN"} : c&apos;est là que votre partenaire vous paiera.{" "}
            <Link href="/app/compte">Compléter mon compte</Link>
          </div>
        </div>
      )}

      <p className="limits-line">
        {usage
          ? `Vous pouvez encore échanger ${remainingAllowance(usage).toLocaleString("fr-FR")} XOF aujourd'hui (ou l'équivalent en euros).`
          : `Jusqu'à ${MAX_ORDER_XOF.toLocaleString("fr-FR")} XOF par échange et par jour, ${MAX_MONTHLY_XOF.toLocaleString("fr-FR")} XOF par mois.`}
      </p>

      {mode === "public" ? (
        <Link href="/inscription" className="btn btn-primary btn-lg btn-block">Créer un compte pour échanger</Link>
      ) : (
        <button type="submit" className="btn btn-primary btn-lg btn-block"
          disabled={pending || est.kind !== "ok" || missingDetails}>
          {pending ? "Enregistrement…" : est.kind === "ok" && est.partners === 0 ? "Publier ma demande" : "Échanger maintenant"}
        </button>
      )}
      {state.error && <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}

      {mode === "app" && (
        <details className="advanced">
          <summary>Options avancées : choisir mon propre taux</summary>
          <label className="field">
            <span className="field-label">
              {sendEur ? "Je veux recevoir au moins (XOF pour 1 €)" : "Je paie au plus (XOF pour 1 €)"}
            </span>
            <span className="input-wrap">
              <input inputMode="decimal" autoComplete="off" value={customRate} placeholder={est.kind === "ok" ? fmtRate(est.limitRate) : "655,957"}
                onChange={(e) => setCustomRate(e.target.value)} aria-label="Mon taux" />
              <span className="suffix">XOF / €</span>
            </span>
            <span className="field-hint">
              Laissez vide pour le meilleur taux disponible. Avec votre propre taux, seules les offres au moins
              aussi bonnes seront prises ; le reste attendra.
            </span>
          </label>
        </details>
      )}
    </form>
  );
}
