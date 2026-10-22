import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { fmtRate } from "@/lib/format";
import { REFERENCE_RATE } from "@/lib/matching";
import { getCurrentUser } from "@/server/auth";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">
            <Logo />
            MEYA
          </Link>
          <span className="tag">Pilote</span>
          <div className="ref-rate">
            Référence <strong className="num">1 € = {fmtRate(REFERENCE_RATE)} XOF</strong>
          </div>
          {user ? (
            <Link href="/app" className="btn btn-primary btn-sm">Mon espace</Link>
          ) : (
            <div className="header-actions">
              <Link href="/connexion" className="btn btn-secondary btn-sm">Se connecter</Link>
              <Link href="/inscription" className="btn btn-primary btn-sm">S&apos;inscrire</Link>
            </div>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
      <footer className="site-footer">
        <p>
          MEYA est un pilote. La plateforme met des particuliers en relation et calcule les
          appariements ; elle ne détient, ne transfère ni ne convertit aucun fonds.
        </p>
        <p>
          <Link href="/simulateur">Simulateur</Link> · <Link href="/inscription">Inscription</Link> · <Link href="/conditions">Conditions du pilote</Link> ·{" "}
          <Link href="/confidentialite">Confidentialité</Link>
        </p>
      </footer>
    </>
  );
}
