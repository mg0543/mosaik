"use client";

import { useId, useState } from "react";

/**
 * Champ mot de passe avec bouton Afficher / Masquer. Le bouton est hors de l'étiquette :
 * le champ s'annonce simplement « Mot de passe » aux lecteurs d'écran.
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  hint,
}: {
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      <span className="input-wrap">
        <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required
          aria-describedby={hintId} spellCheck={false} autoCapitalize="none" />
        <button type="button" className="reveal" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Masquer : ${label}` : `Afficher : ${label}`} aria-pressed={visible}>
          {visible ? "Masquer" : "Afficher"}
        </button>
      </span>
      {hint && <span id={hintId} className="field-hint">{hint}</span>}
    </div>
  );
}
