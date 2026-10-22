"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { placeOrderAction, type ExchangeState } from "@/app/app/echanger/actions";
import { Flag } from "@/components/flags";
import { isXofCountry, XOF_COUNTRIES, type XofCountry } from "@/lib/countries";
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
  /** Ouverture préremplie, par exemple depuis une offre choisie dans Activité. */
  initial?: { side: Side; amount: string; rate?: string };
  /** « hero » : présentation d'accueil (devises avec drapeaux, montants côte à côte). */
  variant?: "card" | "hero";
  /** Pays affiché côté XOF (déduit du numéro de l'utilisateur), modifiable. */
  country?: XofCountry | null;
}

type Estimate =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | {
      kind: "ok";
      limitRate: number;
      /** Ce qui part tout de suite (devise envoyée) et ce qui arrive tout de suite (devise reçue). */
      givenNow: number;
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
        kind: "ok", limitRate, givenNow: r.given, receivedNow: r.received, total: r.received + waitingReceives, partners: r.trades.length,
        waiting, displayRate: r.trades.length > 0 ? averageRate(r.trades) : limitRate, custom: true,
      };
    }
    // Le montant est contrôlé au taux officiel ; le taux choisi ensuite reste dans les garde-fous.
    const refusal = checkOrderPolicy(side, amount, REFERENCE_RATE);
    if (refusal) return { kind: "error", message: refusal };
    const q = quote(book, side, amount);
    return {
      kind: "ok", limitRate: q.limitRate, givenNow: q.result.given, receivedNow: q.result.received, total: q.totalEstimate,
      partners: q.result.trades.length, waiting: q.waiting,
      displayRate: q.result.trades.length > 0 ? averageRate(q.result.trades) : q.limitRate, custom: false,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : "Estimation impossible." };
  }
}

export function Converter({ book, mode, canReceive, usage, initial, variant = "card", country = null }: Props) {
  const [state, action, pending] = useActionState<ExchangeState, FormData>(placeOrderAction, {});
  const [side, setSide] = useState<Side>(initial?.side ?? "SELL_EUR");
  const [amounts, setAmounts] = useState<Record<Side, string>>(() => {
    const defaults: Record<Side, string> = { SELL_EUR: "500", SELL_XOF: "300 000" };
    return initial ? { ...defaults, [initial.side]: initial.amount } : defaults;
  });
  const [customRate, setCustomRate] = useState(initial?.rate ?? "");
  // Matching partiel : ne prendre que ce qui est disponible tout de suite, sans rien laisser en attente.
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [xofCountry, setXofCountry] = useState<XofCountry | null>(country);
  const hero = variant === "hero";
  const sendEur = side === "SELL_EUR";
  const amountInput = amounts[side];
  const est = estimate(book, side, amountInput, customRate, usage);
  const money = (receiving: boolean, n: number) => ((sendEur ? !receiving : receiving) ? fmtEur(n) : fmtXof(n));
  const missingDetails = mode === "app" && canReceive !== undefined && !canReceive[side];
  const partial = est.kind === "ok" && est.partners > 0 && est.waiting > 0;
  const takeOnlyAvailable = partial && onlyAvailable;
  // Montant réellement envoyé au serveur : tout, ou seulement la partie servie tout de suite.
  const submittedAmount =
    takeOnlyAvailable && est.kind === "ok" ? (sendEur ? fmtEurNumber(est.givenNow) : String(est.givenNow)) : amountInput;

  function switchSide(next: Side) {
    setSide(next);
    setCustomRate("");
  }

  return (
    <form action={action} className={hero ? "converter hero" : "converter"} aria-label="Convertisseur">
      <input type="hidden" name="side" value={side} />
      <input type="hidden" name="amount" value={submittedAmount} />
      <input type="hidden" name="rate" value={est.kind === "ok" ? fmtRate(est.limitRate) : ""} />

      {hero ? (
        <>
          <div className="hero-currencies" data-send-currency={sendEur ? "EUR" : "XOF"}>
            <CurrencyBadge currency={sendEur ? "EUR" : "XOF"} country={xofCountry} onCountry={setXofCountry} />
            <CurrencyBadge currency={sendEur ? "XOF" : "EUR"} country={xofCountry} onCountry={setXofCountry} pill />
          </div>
          <div className="hero-amounts">
            <input className="hero-amount num" inputMode={sendEur ? "decimal" : "numeric"} autoComplete="off" aria-label="Montant envoyé"
              value={amountInput} placeholder="0" onChange={(e) => setAmounts((p) => ({ ...p, [side]: e.target.value }))} />
            <button type="button" className="hero-swap" onClick={() => switchSide(sendEur ? "SELL_XOF" : "SELL_EUR")}
              aria-label="Inverser le sens de l'échange">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9h15l-4-4M20 15H5l4 4" /></svg>
            </button>
            <output className="hero-amount received num" aria-label="Montant reçu" aria-live="polite">
              {est.kind !== "ok" ? "0" : sendEur ? fmtXofNumber(est.total) : fmtEurNumber(est.total)}
            </output>
          </div>
          {est.kind === "ok" && (
            <p className="hero-rate num">
              1,00 € = {fmtRate(est.displayRate)} FCFA <span aria-hidden="true">•</span> Sans frais MEYA
            </p>
          )}
          {est.kind === "ok" && !(mode === "app" && partial) && (
            <p className={est.waiting === 0 ? "hero-status ok" : "hero-status pending"}>
              {est.waiting === 0
                ? `${est.partners} partenaire${est.partners > 1 ? "s" : ""} disponible${est.partners > 1 ? "s" : ""} maintenant`
                : est.partners > 0
                  ? `${money(true, est.receivedNow)} tout de suite, le reste dès qu'un partenaire accepte ${fmtRate(est.limitRate)}`
                  : `Pas de partenaire à l'instant : votre demande sera publiée au taux de ${fmtRate(est.limitRate)}`}
            </p>
          )}
        </>
      ) : (
        <>
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
        </>
      )}

      {est.kind === "error" && <p className="error" role="alert" style={{ margin: 0 }}>{est.message}</p>}

      {!hero && est.kind === "ok" && (
        <ul className="quote-facts">
          <li><span>Taux</span><strong className="num">1 € = {fmtRate(est.displayRate)} XOF</strong></li>
          <li><span>Frais MEYA</span><strong>0 pendant le pilote</strong></li>
          {/* Dans l'application, le choix « tout / partie disponible » remplace ce message. */}
          {!(mode === "app" && partial) && <li className={est.waiting === 0 ? "ok" : "pending"}>
            {est.waiting === 0
              ? `Disponible maintenant : ${est.partners} partenaire${est.partners > 1 ? "s" : ""} prêt${est.partners > 1 ? "s" : ""} à échanger.`
              : est.partners > 0
                ? `${money(true, est.receivedNow)} tout de suite ; le reste (${money(false, est.waiting)}) dès qu'un partenaire accepte le taux de ${fmtRate(est.limitRate)}.`
                : `Aucun partenaire disponible à l'instant : votre demande sera publiée au taux de ${fmtRate(est.limitRate)} et servie dès qu'une personne correspond.`}
          </li>}
        </ul>
      )}

      {mode === "app" && partial && est.kind === "ok" && (
        <fieldset className="partial-choice">
          <legend>Il n&apos;y a pas de partenaire pour tout le montant. Que voulez-vous faire ?</legend>
          <label className={!onlyAvailable ? "selected" : undefined}>
            <input type="radio" name="partial" checked={!onlyAvailable} onChange={() => setOnlyAvailable(false)} />
            <span>
              <strong>Tout échanger</strong>
              <span>
                {money(true, est.receivedNow)} tout de suite ; le reste ({money(false, est.waiting)}) attend un
                partenaire au taux de {fmtRate(est.limitRate)}.
              </span>
            </span>
          </label>
          <label className={onlyAvailable ? "selected" : undefined}>
            <input type="radio" name="partial" checked={onlyAvailable} onChange={() => setOnlyAvailable(true)} />
            <span>
              <strong>Seulement la partie disponible</strong>
              <span>
                Échanger {money(false, est.givenNow)} contre {money(true, est.receivedNow)} maintenant ; rien ne reste
                en attente.
              </span>
            </span>
          </label>
        </fieldset>
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
          {pending
            ? "Enregistrement…"
            : est.kind === "ok" && est.partners === 0
              ? "Publier ma demande"
              : takeOnlyAvailable && est.kind === "ok"
                ? `Échanger ${money(false, est.givenNow)} maintenant`
                : "Échanger maintenant"}
        </button>
      )}
      {state.error && <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}

      {mode === "app" && (
        <details className="advanced" open={Boolean(initial?.rate)}>
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

/** Devise avec son drapeau ; côté XOF, un menu permet de choisir le pays. */
function CurrencyBadge({
  currency,
  country,
  onCountry,
  pill = false,
}: {
  currency: "EUR" | "XOF";
  country: XofCountry | null;
  onCountry: (c: XofCountry) => void;
  pill?: boolean;
}) {
  if (currency === "EUR") {
    return (
      <span className={pill ? "cur-badge pill" : "cur-badge"}>
        <Flag code="EU" size={26} />
        <span>EUR</span>
      </span>
    );
  }
  return (
    <label className={pill ? "cur-badge pill select" : "cur-badge select"}>
      {country ? <Flag code={country} size={26} /> : <span className="cfa-coin" aria-hidden="true">CFA</span>}
      <span>XOF</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      <select aria-label="Pays du franc CFA" value={country ?? ""} onChange={(e) => isXofCountry(e.target.value) && onCountry(e.target.value)}>
        <option value="" disabled>Choisir le pays</option>
        {XOF_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </label>
  );
}
