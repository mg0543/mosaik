"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {
    step: "email",
    error: initialError,
  });

  if (state.step === "code") {
    return (
      <form action={action} className="stack-form">
        <p className="muted">
          Un code à 6 chiffres a été envoyé à <strong>{state.email}</strong>. Il expire dans 15 minutes.
        </p>
        <input type="hidden" name="email" value={state.email} />
        <label className="field">
          <span className="field-label">Code reçu par e-mail</span>
          <span className="input-wrap">
            <input name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7}
              placeholder="123456" required autoFocus className="code-input" aria-describedby="login-message" />
          </span>
        </label>
        <Message state={state} />
        <button type="submit" name="intent" value="verify" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Vérification…" : "Se connecter"}
        </button>
        <div className="form-links">
          <button type="submit" name="intent" value="resend" className="link-btn" formNoValidate disabled={pending}>
            Renvoyer un code
          </button>
          <button type="submit" name="intent" value="change" className="link-btn" formNoValidate disabled={pending}>
            Changer d&apos;adresse
          </button>
        </div>
        <p className="field-hint">Vous pouvez aussi ouvrir le lien reçu dans l&apos;e-mail.</p>
      </form>
    );
  }

  return (
    <form action={action} className="stack-form">
      <label className="field">
        <span className="field-label">Adresse e-mail</span>
        <span className="input-wrap">
          <input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.email}
            placeholder="vous@exemple.com" required autoFocus aria-describedby="login-message" />
        </span>
      </label>
      <Message state={state} />
      <button type="submit" name="intent" value="send" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Envoi…" : "Recevoir un code"}
      </button>
      <p className="field-hint">Pas de mot de passe : un code vous est envoyé à chaque connexion.</p>
      <p className="field-hint">
        En continuant, vous acceptez les <a href="/conditions">conditions du pilote</a> et la{" "}
        <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </form>
  );
}

function Message({ state }: { state: LoginState }) {
  if (state.error) return <p id="login-message" className="error" role="alert">{state.error}</p>;
  if (state.step === "code" && state.info) return <p id="login-message" className="success-text" role="status">{state.info}</p>;
  return null;
}
