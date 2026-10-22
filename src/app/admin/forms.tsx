"use client";

import { useActionState, useState, type ReactNode } from "react";
import type { AdminActionState } from "./actions";

type Action = (prev: AdminActionState, formData: FormData) => Promise<AdminActionState>;

/**
 * Formulaire d'action d'administration : champs cachés, motif éventuel, confirmation explicite
 * pour les actions sensibles, retour lisible.
 */
export function AdminForm({
  action,
  hidden,
  label,
  danger = false,
  reasonLabel,
  children,
  confirm,
}: {
  action: Action;
  hidden: Record<string, string>;
  label: string;
  danger?: boolean;
  /** Si fourni, un motif est demandé (obligatoire). */
  reasonLabel?: string;
  children?: ReactNode;
  /** Si fourni, un premier clic ouvre le formulaire avec ce titre. */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(action, {});
  const [open, setOpen] = useState(!confirm);

  if (state.done) return <span className="admin-done">{state.done}</span>;
  if (!open) {
    return (
      <button type="button" className={`btn btn-sm ${danger ? "btn-danger" : "btn-secondary"}`} onClick={() => setOpen(true)}>
        {confirm}
      </button>
    );
  }
  return (
    <form action={formAction} className="admin-form">
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      {children}
      {reasonLabel && (
        <input name="reason" required minLength={3} maxLength={500} placeholder={reasonLabel} aria-label={reasonLabel} className="admin-input" />
      )}
      <div className="admin-form-row">
        <button type="submit" className={`btn btn-sm ${danger ? "btn-danger" : "btn-primary"}`} disabled={pending}>
          {pending ? "…" : label}
        </button>
        {confirm && (
          <button type="button" className="link-btn" onClick={() => setOpen(false)} disabled={pending}>Annuler</button>
        )}
      </div>
      {state.error && <p className="error" role="alert" style={{ margin: 0 }}>{state.error}</p>}
    </form>
  );
}
