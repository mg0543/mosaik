"use client";

import { useActionState, useState } from "react";
import { LocalDate } from "@/components/local-date";
import { fmtEur, fmtRate, fmtXof } from "@/lib/format";
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
} from "@/lib/settlement";
import type { SettlementView } from "@/server/queries";
import { confirmStepAction, disputeAction, type SettlementActionState } from "./actions";

const money = (currency: "EUR" | "XOF", amount: number) => (currency === "EUR" ? fmtEur(amount) : fmtXof(amount));

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

/** Un échange et son règlement direct entre les deux participants. */
export function SettlementCard({ index, tradeId, orderId, role, rate, createdAt, settlement, now }: Props) {
  const status = settlementStatus(settlement, role, now);
  const myStep = actionFor(settlement, role);
  const pending = nextStep(settlement);
  const send = settlement.youSend;
  const receive = settlement.youReceive;
  const reference = tradeId.slice(0, 8).toUpperCase();

  return (
    <li className="card trade-item settlement">
      <div className="trade-head">
        <span>Contrepartie {index}</span>
        <span className={`chip chip-${status.tone}`}>{status.label}</span>
      </div>
      <div className="trade-amounts num">
        <span>Vous envoyez : {money(send.currency, send.amount)}</span>
        <span>Vous recevez : {money(receive.currency, receive.amount)}</span>
      </div>
      <div className="muted trade-rate">
        Taux {fmtRate(rate)} · échange du <LocalDate date={createdAt} /> · réf. {reference}
      </div>

      <ol className="steps-track" aria-label="Étapes du règlement">
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

      {settlement.disputedAt ? (
        <div className="notice warn" style={{ marginTop: 12 }}>
          <div>
            <strong>Litige signalé {settlement.disputedByYou ? "par vous" : "par la contrepartie"}.</strong> Le règlement
            est gelé. Prévenez l&apos;équipe du pilote en indiquant la référence <strong>{reference}</strong>.
            {settlement.disputeReason && <p className="dispute-reason">« {settlement.disputeReason} »</p>}
          </div>
        </div>
      ) : !pending ? (
        <p className="success-text" style={{ marginTop: 12 }}>Échange réglé : les deux paiements sont confirmés.</p>
      ) : myStep ? (
        <StepForm tradeId={tradeId} orderId={orderId} step={myStep} send={send} receive={receive} dueAt={settlement.dueAt} />
      ) : (
        <p className="muted waiting">
          {pending === "taker_sent" || pending === "maker_sent"
            ? `La contrepartie doit vous envoyer ${money(receive.currency, receive.amount)} sur vos coordonnées de réception.`
            : "La contrepartie doit confirmer qu'elle a bien reçu votre paiement."}{" "}
          Échéance : <LocalDate date={settlement.dueAt} />.
        </p>
      )}

      {!settlement.disputedAt && pending && <DisputeForm tradeId={tradeId} orderId={orderId} />}
    </li>
  );
}

function StepForm({
  tradeId,
  orderId,
  step,
  send,
  receive,
  dueAt,
}: {
  tradeId: string;
  orderId: string;
  step: NonNullable<ReturnType<typeof actionFor>>;
  send: SettlementView["youSend"];
  receive: SettlementView["youReceive"];
  dueAt: Date;
}) {
  const [state, action, busy] = useActionState<SettlementActionState, FormData>(confirmStepAction, {});
  const [checked, setChecked] = useState(false);
  const sending = step === "taker_sent" || step === "maker_sent";
  const payTo = describePayTo(send.payTo);

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
          <dl className="pay-to">
            <div><dt>Moyen</dt><dd>{payTo.method}</dd></div>
            <div><dt>{send.payTo.method === "iban" ? "IBAN" : "Numéro"}</dt><dd className="num">{payTo.account}</dd></div>
            <div><dt>Titulaire</dt><dd>{payTo.holder}</dd></div>
          </dl>
          <p className="field-hint">
            Avant le <LocalDate date={dueAt} />. N&apos;envoyez qu&apos;à ces coordonnées : Mosaik ne vous demandera
            jamais d&apos;en utiliser d&apos;autres.
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
      <button type="submit" className="btn btn-primary" disabled={!checked || busy}>
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
          placeholder="Par exemple : j'ai envoyé le paiement il y a 24 h et la contrepartie ne confirme pas." />
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
