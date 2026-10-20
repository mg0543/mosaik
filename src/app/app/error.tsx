"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Erreur inattendue dans l'espace connecté : message clair et possibilité de réessayer. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="app-page status-block">
      <h1 className="app-title">Un problème est survenu</h1>
      <p className="muted">
        La page n&apos;a pas pu être chargée. Vos ordres ne sont pas affectés : rien n&apos;est enregistré
        sans confirmation.
      </p>
      {error.digest && <p className="field-hint">Référence : {error.digest}</p>}
      <div className="confirm-actions">
        <button type="button" className="btn btn-primary" onClick={reset}>Réessayer</button>
        <Link href="/app" className="btn btn-secondary">Accueil</Link>
      </div>
    </div>
  );
}
