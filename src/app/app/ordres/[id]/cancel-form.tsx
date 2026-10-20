"use client";

import { useActionState, useState } from "react";
import { cancelOrderAction, type CancelState } from "./actions";

export function CancelForm({ orderId, remainingLabel }: { orderId: string; remainingLabel: string }) {
  const [state, action, pending] = useActionState<CancelState, FormData>(cancelOrderAction, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="btn btn-secondary btn-block" onClick={() => setConfirming(true)}>
        Annuler l&apos;ordre
      </button>
    );
  }

  return (
    <form action={action} className="confirm-box">
      <input type="hidden" name="orderId" value={orderId} />
      <p style={{ margin: 0 }}>
        Annuler l&apos;ordre ? Les <strong>{remainingLabel}</strong> non échangés sortent du carnet. Les
        échanges déjà faits restent valables.
      </p>
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div className="confirm-actions">
        <button type="submit" className="btn btn-danger" disabled={pending}>
          {pending ? "Annulation…" : "Oui, annuler"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={pending}>
          Garder l&apos;ordre
        </button>
      </div>
    </form>
  );
}
