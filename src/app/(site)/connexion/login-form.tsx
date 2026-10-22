"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/password-field";
import { signInAction, type SignInState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, { error: initialError });

  return (
    <form action={action} className="stack-form">
      <label className="field">
        <span className="field-label">Adresse e-mail</span>
        <span className="input-wrap">
          <input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={state.email}
            placeholder="vous@exemple.com" required autoFocus />
        </span>
      </label>
      <PasswordField name="password" label="Mot de passe" autoComplete="current-password" />
      <div className="form-links">
        <span />
        <Link href="/connexion/mot-de-passe-oublie" className="link-small">Mot de passe oublié ?</Link>
      </div>
      {state.error && <p id="auth-message" className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </button>
      <p className="field-hint center">
        Pas encore de compte ? <Link href="/inscription">Créer un compte</Link>
      </p>
    </form>
  );
}
