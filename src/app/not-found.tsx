import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="status-page">
      <Logo size={36} />
      <h1>Page introuvable</h1>
      <p className="muted">Cette page n&apos;existe pas, ou vous n&apos;y avez pas accès.</p>
      <Link href="/" className="btn btn-primary">Retour à l&apos;accueil</Link>
    </main>
  );
}
