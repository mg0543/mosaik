"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/password-field";
import { PASSWORD_MIN_LENGTH } from "@/lib/account";
import { resetPasswordAction, type ResetState } from "../actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPasswordAction, { step: "email" });

  if (state.step === "code") {
    return (
      <form action={action} className="stack-form">
        <p className="muted" style={{ margin: 0 }}>
          Si un compte existe pour <strong>{state.email}</strong>, un code à 6 chiffres vient d&apos;y être envoyé.
          Il expire dans 15 minutes.
        </p>
        <input type="hidden" name="email" value={state.email} />
        <label className="field">
          <span className="field-label">Code reçu par e-mail</span>
          <span className="input-wrap">
            <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7}
              placeholder="123456" required autoFocus className="code-input" />
          </span>
        </label>
        <PasswordField name="password" label="Nouveau mot de passe" autoComplete="new-password"
          hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères, dont une lettre et un chiffre.`} />
        <PasswordField name="passwordConfirm" label="Confirmer le nouveau mot de passe" autoComplete="new-password" />
        {state.error && <p id="auth-message" className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
        {!state.error && state.info && <p className="success-text" role="status">{state.info}</p>}
        <button type="submit" name="intent" value="verify" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Enregistrement…" : "Changer mon mot de passe"}
        </button>
        <div className="form-links">
          <button type="submit" name="intent" value="resend" className="link-btn" formNoValidate disabled={pending}>
            Renvoyer un code
          </button>
          <button type="submit" name="intent" value="change" className="link-btn" formNoValidate disabled={pending}>
            Changer d&apos;adresse
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={action} className="stack-form">
      <label className="field">
        <span className="field-label">Adresse e-mail du compte</span>
        <span className="input-wrap">
          <input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.email}
            placeholder="vous@exemple.com" required autoFocus />
        </span>
      </label>
      {state.error && <p id="auth-message" className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <button type="submit" name="intent" value="send" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir un code"}
      </button>
      <p className="field-hint center">
        <Link href="/connexion">Retour à la connexion</Link>
      </p>
    </form>
  );
}
