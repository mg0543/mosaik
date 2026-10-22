"use client";

import { useActionState, useEffect, useState } from "react";
import { LocalDate } from "@/components/local-date";
import { fmtEur, fmtEurNumber, fmtRate, fmtXof, fmtXofNumber } from "@/lib/format";
import { describePayTo } from "@/lib/payment";
import {
  actionFor,
  nextStep,
  settlementStatus,
  STEPS,
  stepButton,
  stepDoneAt,
  stepLabel,
  type SettlementRole,
  type SettlementStep,
} from "@/lib/settlement";
import type { SettlementView } from "@/server/queries";
import { confirmStepAction, disputeAction, type SettlementActionState } from "./actions";

const money = (currency: "EUR" | "XOF", amount: number) => (currency === "EUR" ? fmtEur(amount) : fmtXof(amount));
const plainAmount = (currency: "EUR" | "XOF", amount: number) =>
  currency === "EUR" ? fmtEurNumber(amount) : fmtXofNumber(amount);

interface Props {
  index: number;
  tradeId: string;
  orderId: string;
  role: SettlementRole;
  rate: number;
  createdAt: Date;
  settlement: SettlementView;
  now: Date;
}

/** Règlement guidé d'un échange : étape en cours, consignes, compte à rebours et historique. */
export function SettlementCard({ index, tradeId, orderId, role, rate, createdAt, settlement, now }: Props) {
  const status = settlementStatus(settlement, role, now);
  const myStep = actionFor(settlement, role);
  const pending = nextStep(settlement);
  const done = STEPS.filter((s) => stepDoneAt(settlement, s)).length;
  const send = settlement.youSend;
  const receive = settlement.youReceive;
  const reference = tradeId.slice(0, 8).toUpperCase();

  return (
    <li className="card trade-item settlement">
      <div className="trade-head">
        <span>Partenaire {index}</span>
        <span className={`chip chip-${status.tone}`}>{status.label}</span>
      </div>
      <div className="trade-amounts num">
        <span>Vous envoyez : {money(send.currency, send.amount)}</span>
        <span>Vous recevez : {money(receive.currency, receive.amount)}</span>
      </div>
      <div className="muted trade-rate">
        1 € = {fmtRate(rate)} XOF · conclu le <LocalDate date={createdAt} /> · réf. {reference}
      </div>

      <div className="stepper" aria-label={`Règlement : ${done} étape${done > 1 ? "s" : ""} sur 4 terminée${done > 1 ? "s" : ""}`}>
        <div className="stepper-head">
          <strong>{pending ? `Étape ${done + 1} sur 4` : "Règlement terminé"}</strong>
          {pending && !settlement.disputedAt && <Countdown dueAt={settlement.dueAt} initialNow={now} />}
        </div>
        <div className="stepper-bar" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className={i < done ? "done" : i === done && pending && !settlement.disputedAt ? "current" : undefined} />
          ))}
        </div>
      </div>

      {settlement.disputedAt ? (
        <div className="notice warn" style={{ marginTop: 12 }}>
          <div>
            <strong>Litige signalé {settlement.disputedByYou ? "par vous" : "par votre partenaire"}.</strong> Le
            règlement est gelé. Prévenez l&apos;équipe du pilote en indiquant la référence <strong>{reference}</strong>.
            {settlement.disputeReason && <p className="dispute-reason">« {settlement.disputeReason} »</p>}
          </div>
        </div>
      ) : !pending ? (
        <div className="done-box">
          <span className="done-check" aria-hidden="true">✓</span>
          <p>Échange réglé : les deux paiements sont confirmés.</p>
        </div>
      ) : myStep ? (
        <StepForm tradeId={tradeId} orderId={orderId} step={myStep} send={send} receive={receive} />
      ) : (
        <div className="waiting-box">
          <span className="waiting-icon" aria-hidden="true">⏳</span>
          <p>
            {pending === "taker_sent" || pending === "maker_sent"
              ? `Votre partenaire doit vous envoyer ${money(receive.currency, receive.amount)} sur vos coordonnées de réception.`
              : "Votre partenaire doit confirmer qu'il a bien reçu votre paiement."}{" "}
            Revenez sur cette page pour suivre l&apos;avancement.
          </p>
        </div>
      )}

      <details className="history">
        <summary>Voir les étapes</summary>
        <ol className="steps-track">
          {STEPS.map((step) => {
            const doneAt = stepDoneAt(settlement, step);
            return (
              <li key={step} className={doneAt ? "is-done" : step === pending && !settlement.disputedAt ? "is-current" : undefined}>
                <span className="step-mark" aria-hidden="true">{doneAt ? "✓" : ""}</span>
                <span className="step-text">
                  {stepLabel(step, role)}
                  {doneAt && <span className="muted"> · <LocalDate date={doneAt} /></span>}
                </span>
              </li>
            );
          })}
        </ol>
      </details>

      {!settlement.disputedAt && pending && <DisputeForm tradeId={tradeId} orderId={orderId} />}
    </li>
  );
}

/** Temps restant avant l'échéance, mis à jour chaque minute. */
function Countdown({ dueAt, initialNow }: { dueAt: Date; initialNow: Date }) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const minutes = Math.round((dueAt.getTime() - now.getTime()) / 60_000);
  const late = minutes < 0;
  const abs = Math.abs(minutes);
  const label = `${Math.floor(abs / 60)} h ${String(abs % 60).padStart(2, "0")} min`;
  return <span className={late ? "countdown late" : "countdown"}>{late ? `En retard de ${label}` : `Il reste ${label}`}</span>;
}

/** Bouton qui copie une valeur (IBAN, numéro, montant) pour éviter les fautes de recopie. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible : la valeur reste sélectionnable à la main.
    }
  }
  return (
    <button type="button" className="copy" onClick={copy} aria-label={`Copier ${label}`}>
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

function StepForm({
  tradeId,
  orderId,
  step,
  send,
  receive,
}: {
  tradeId: string;
  orderId: string;
  step: SettlementStep;
  send: SettlementView["youSend"];
  receive: SettlementView["youReceive"];
}) {
  const [state, action, busy] = useActionState<SettlementActionState, FormData>(confirmStepAction, {});
  const [checked, setChecked] = useState(false);
  const sending = step === "taker_sent" || step === "maker_sent";
  const payTo = describePayTo(send.payTo);
  const isIban = send.payTo.method === "iban";

  return (
    <form action={action} className="step-box">
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="step" value={step} />
      {sending ? (
        <>
          <p className="step-box-title">
            À vous : envoyez exactement <strong className="num">{money(send.currency, send.amount)}</strong> à
          </p>
          <ol className="instructions">
            <li>Ouvrez {isIban ? "votre application bancaire" : `votre application ${payTo.method}`}.</li>
            <li>Faites {isIban ? "un virement" : "un transfert"} vers les coordonnées ci-dessous, du montant exact.</li>
            <li>Revenez ici et confirmez l&apos;envoi.</li>
          </ol>
          <dl className="pay-to">
            <div><dt>Moyen</dt><dd>{payTo.method}</dd></div>
            <div>
              <dt>{isIban ? "IBAN" : "Numéro"}</dt>
              <dd className="num">{payTo.account} <CopyButton value={send.payTo.account} label={isIban ? "l'IBAN" : "le numéro"} /></dd>
            </div>
            <div><dt>Titulaire</dt><dd>{payTo.holder}</dd></div>
            <div>
              <dt>Montant</dt>
              <dd className="num">
                {money(send.currency, send.amount)} <CopyButton value={plainAmount(send.currency, send.amount)} label="le montant" />
              </dd>
            </div>
          </dl>
          <p className="field-hint" style={{ margin: 0 }}>
            N&apos;envoyez qu&apos;à ces coordonnées : MEYA ne vous demandera jamais d&apos;en utiliser d&apos;autres. Si votre
            partenaire vous en propose d&apos;autres, signalez un problème.
          </p>
        </>
      ) : (
        <p className="step-box-title">
          À vous : vérifiez sur votre compte que vous avez bien reçu{" "}
          <strong className="num">{money(receive.currency, receive.amount)}</strong>. Ne confirmez qu&apos;une fois
          l&apos;argent effectivement arrivé.
        </p>
      )}
      <label className="check">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        {sending
          ? `J'ai envoyé ${money(send.currency, send.amount)} à ${payTo.holder}.`
          : `J'ai reçu ${money(receive.currency, receive.amount)} sur mon compte.`}
      </label>
      {state.error && <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={!checked || busy}>
        {busy ? "Enregistrement…" : stepButton(step)}
      </button>
    </form>
  );
}

function DisputeForm({ tradeId, orderId }: { tradeId: string; orderId: string }) {
  const [state, action, busy] = useActionState<SettlementActionState, FormData>(disputeAction, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="link-btn dispute-link" onClick={() => setOpen(true)}>
        Signaler un problème
      </button>
    );
  }
  return (
    <form action={action} className="step-box">
      <input type="hidden" name="tradeId" value={tradeId} />
      <input type="hidden" name="orderId" value={orderId} />
      <label className="field">
        <span className="field-label">Que se passe-t-il ?</span>
        <textarea name="reason" rows={3} minLength={5} maxLength={500} required className="textarea"
          placeholder="Par exemple : j'ai envoyé le paiement il y a 24 h et mon partenaire ne confirme pas." />
      </label>
      <p className="field-hint" style={{ margin: 0 }}>Le signalement gèle ce règlement : plus aucune étape ne pourra être confirmée.</p>
      {state.error && <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <div className="confirm-actions">
        <button type="submit" className="btn btn-danger" disabled={busy}>{busy ? "Envoi…" : "Signaler"}</button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Annuler</button>
      </div>
    </form>
  );
}
