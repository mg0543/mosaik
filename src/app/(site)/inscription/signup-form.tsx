"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/password-field";
import { PASSWORD_MIN_LENGTH } from "@/lib/account";
import { signUpAction, type SignUpState } from "../connexion/actions";

export function SignUpForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUpAction, {});

  if (state.confirmEmail) {
    return (
      <div className="stack-form" role="status">
        <p style={{ margin: 0 }}>
          Presque fini ! Un e-mail de confirmation a été envoyé à <strong>{state.confirmEmail}</strong>. Ouvrez le
          lien qu&apos;il contient pour activer votre compte, puis connectez-vous.
        </p>
        <Link href="/connexion" className="btn btn-secondary">Aller à la connexion</Link>
      </div>
    );
  }

  const f = state.fields;
  return (
    <form action={action} className="stack-form">
      <div className="fields">
        <label className="field">
          <span className="field-label">Prénom</span>
          <span className="input-wrap">
            <input name="firstName" autoComplete="given-name" defaultValue={f?.firstName} required maxLength={50} autoFocus />
          </span>
        </label>
        <label className="field">
          <span className="field-label">Nom</span>
          <span className="input-wrap">
            <input name="lastName" autoComplete="family-name" defaultValue={f?.lastName} required maxLength={50} />
          </span>
        </label>
      </div>
      <label className="field">
        <span className="field-label">Adresse e-mail</span>
        <span className="input-wrap">
          <input name="email" type="email" inputMode="email" autoComplete="email" defaultValue={f?.email}
            placeholder="vous@exemple.com" required />
        </span>
      </label>
      <label className="field">
        <span className="field-label">
          Téléphone <span className="optional">(facultatif)</span>
        </span>
        <span className="input-wrap">
          <input name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={f?.phone}
            placeholder="+221 77 123 45 67" aria-describedby="phone-hint" />
        </span>
        <span id="phone-hint" className="field-hint">Avec l&apos;indicatif du pays : +221, +225, +33…</span>
      </label>
      <PasswordField name="password" label="Mot de passe" autoComplete="new-password"
        hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères, dont une lettre et un chiffre.`} />
      <PasswordField name="passwordConfirm" label="Confirmer le mot de passe" autoComplete="new-password" />
      <label className="check">
        <input type="checkbox" name="terms" required />
        <span>
          J&apos;accepte les <a href="/conditions" target="_blank">conditions du pilote</a> et la{" "}
          <a href="/confidentialite" target="_blank">politique de confidentialité</a>.
        </span>
      </label>
      {state.error && <p id="auth-message" className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
      <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
        {pending ? "Création du compte…" : "Créer mon compte"}
      </button>
      <p className="field-hint center">
        Déjà inscrit ? <Link href="/connexion">Se connecter</Link>
      </p>
    </form>
  );
}
