"use client";

import { useActionState } from "react";
import { fmtIban, fmtPhone, XOF_OPERATORS, type PaymentDetails } from "@/lib/payment";
import { saveEurDetailsAction, saveXofDetailsAction, type DetailsState } from "./actions";

/** Coordonnées de réception : où vos contreparties vous paient. */
export function PaymentForms({ details }: { details: PaymentDetails }) {
  const [eurState, eurAction, eurPending] = useActionState<DetailsState, FormData>(saveEurDetailsAction, {});
  const [xofState, xofAction, xofPending] = useActionState<DetailsState, FormData>(saveXofDetailsAction, {});

  return (
    <>
      <form action={eurAction} className="card details-form" aria-labelledby="eur-title">
        <div className="card-body stack-form">
          <div>
            <h2 id="eur-title" className="details-title">Pour recevoir des euros</h2>
            <p className="field-hint" style={{ margin: 0 }}>
              {details.eurIban ? "Renseigné." : "Nécessaire pour recevoir des euros."}
            </p>
          </div>
          <label className="field">
            <span className="field-label">IBAN</span>
            <span className="input-wrap">
              <input name="iban" autoComplete="off" autoCapitalize="characters" spellCheck={false} required
                defaultValue={details.eurIban ? fmtIban(details.eurIban) : ""} placeholder="FR76 3000 6000 0112 3456 7890 189" />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Titulaire du compte</span>
            <span className="input-wrap">
              <input name="holder" autoComplete="name" required defaultValue={details.eurHolder ?? ""} placeholder="Prénom Nom" />
            </span>
          </label>
          <Feedback state={eurState} />
          <button type="submit" className="btn btn-secondary" disabled={eurPending}>
            {eurPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>

      <form action={xofAction} className="card details-form" aria-labelledby="xof-title">
        <div className="card-body stack-form">
          <div>
            <h2 id="xof-title" className="details-title">Pour recevoir des XOF</h2>
            <p className="field-hint" style={{ margin: 0 }}>
              {details.xofPhone ? "Renseigné." : "Nécessaire pour recevoir des francs CFA."}
            </p>
          </div>
          <label className="field">
            <span className="field-label">Opérateur mobile money</span>
            <span className="input-wrap">
              <select name="operator" required defaultValue={details.xofOperator ?? ""}>
                <option value="" disabled>Choisir…</option>
                {Object.entries(XOF_OPERATORS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="field-label">Numéro, avec l&apos;indicatif du pays</span>
            <span className="input-wrap">
              <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required
                defaultValue={details.xofPhone ? fmtPhone(details.xofPhone) : ""} placeholder="+221 77 123 45 67" />
            </span>
          </label>
          <label className="field">
            <span className="field-label">Nom du titulaire</span>
            <span className="input-wrap">
              <input name="holder" autoComplete="name" required defaultValue={details.xofHolder ?? ""} placeholder="Prénom Nom" />
            </span>
          </label>
          <Feedback state={xofState} />
          <button type="submit" className="btn btn-secondary" disabled={xofPending}>
            {xofPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </>
  );
}

function Feedback({ state }: { state: DetailsState }) {
  if (state.error) return <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>;
  if (state.saved) return <p className="success-text" role="status">Coordonnées enregistrées.</p>;
  return null;
}
