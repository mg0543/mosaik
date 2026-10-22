import Link from "next/link";

/** Ordre ou page introuvable dans l'espace connecté (y compris l'ordre d'un autre utilisateur). */
export default function AppNotFound() {
  return (
    <div className="app-page status-block">
      <h1 className="app-title">Introuvable</h1>
      <p className="muted">Cet échange n&apos;existe pas, ou il ne vous appartient pas.</p>
      <Link href="/app/activite" className="btn btn-primary">Activité</Link>
    </div>
  );
}
