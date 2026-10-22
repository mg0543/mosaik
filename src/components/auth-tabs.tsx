import Link from "next/link";

/** Bascule entre connexion et inscription, en haut des deux pages. */
export function AuthTabs({ active }: { active: "connexion" | "inscription" }) {
  return (
    <nav className="segmented auth-tabs" aria-label="Connexion ou inscription">
      <Link href="/connexion" aria-current={active === "connexion" ? "page" : undefined}>
        Se connecter
      </Link>
      <Link href="/inscription" aria-current={active === "inscription" ? "page" : undefined}>
        S&apos;inscrire
      </Link>
    </nav>
  );
}
