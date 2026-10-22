import Link from "next/link";
import { Converter } from "@/components/converter";
import { ExchangeIllustration, StepIcon } from "@/components/illustrations";
import type { PublicBookEntry } from "@/lib/preview";
import { isBackendConfigured } from "@/server/config";
import { getSql } from "@/server/db";
import { getPublicBook } from "@/server/queries";

// Les offres changent à chaque échange : la page est rendue à chaque visite.
export const dynamic = "force-dynamic";

async function loadBook(): Promise<PublicBookEntry[]> {
  if (!isBackendConfigured()) return [];
  try {
    return await getPublicBook(getSql());
  } catch (error) {
    console.error("Lecture des offres impossible", error);
    return [];
  }
}

export default async function HomePage() {
  const book = await loadBook();

  return (
    <>
      <section className="landing-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Euro ⇄ Franc CFA, entre particuliers</span>
          <h1>Changez vos euros et vos francs CFA, simplement.</h1>
          <p className="hero-lead">
            Indiquez combien vous envoyez : MEYA vous montre tout de suite combien vous recevez, au meilleur
            taux proposé par d&apos;autres particuliers. Sans frais pendant le pilote.
          </p>
          <ul className="hero-points">
            <li><StepIcon name="rate" /> Le meilleur taux disponible, affiché avant de vous engager</li>
            <li><StepIcon name="shield" /> Chaque étape du paiement confirmée des deux côtés</li>
            <li><StepIcon name="free" /> 0 frais MEYA pendant le pilote</li>
          </ul>
          <div className="hero-art"><ExchangeIllustration size={190} /></div>
        </div>
        <div className="hero-card">
          <Converter book={book} mode="public" />
        </div>
      </section>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title" className="big-title">Comment ça marche</h2>
        <ol className="how-steps">
          <li className="how-step">
            <StepIcon name="amount" />
            <span className="how-num">1</span>
            <h3>Vous indiquez un montant</h3>
            <p>Par exemple 500 €. MEYA calcule ce que vous recevez en francs CFA avec les meilleures offres du moment.</p>
          </li>
          <li className="how-step">
            <StepIcon name="match" />
            <span className="how-num">2</span>
            <h3>MEYA trouve vos partenaires</h3>
            <p>
              Une ou plusieurs personnes font l&apos;échange inverse. S&apos;il n&apos;y en a pas encore, votre demande est
              publiée et servie dès que quelqu&apos;un correspond.
            </p>
          </li>
          <li className="how-step">
            <StepIcon name="settle" />
            <span className="how-num">3</span>
            <h3>Vous vous payez, pas à pas</h3>
            <p>
              MEYA vous dit exactement combien envoyer et à qui (virement ou mobile money), puis chacun confirme
              l&apos;envoi et la réception. Comptez 24 heures au plus.
            </p>
          </li>
        </ol>
      </section>

      <section className="why" aria-labelledby="why-title">
        <h2 id="why-title" className="big-title">Pourquoi faire confiance à MEYA</h2>
        <div className="why-grid">
          <div className="why-card">
            <StepIcon name="rate" />
            <h3>Jamais moins bien qu&apos;annoncé</h3>
            <p>
              Le taux affiché avant de confirmer est un plancher : vous n&apos;échangez jamais à un taux moins bon,
              y compris pour la partie qui attend un partenaire.
            </p>
          </div>
          <div className="why-card">
            <StepIcon name="shield" />
            <h3>Un parcours encadré</h3>
            <p>
              Ordre de paiement imposé, une seule personne exposée à la fois, coordonnées figées et signalement
              en cas de problème.
            </p>
          </div>
          <div className="why-card">
            <StepIcon name="free" />
            <h3>Votre argent ne passe pas par nous</h3>
            <p>Vous payez directement votre partenaire. MEYA ne détient jamais vos fonds.</p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div>
          <h2>Prêt à faire votre premier échange ?</h2>
          <p>Inscription en une minute. Seuls votre nom, votre e-mail et un mot de passe sont nécessaires.</p>
        </div>
        <div className="cta-row">
          <Link href="/inscription" className="btn btn-sun btn-lg">Créer un compte</Link>
          <Link href="/connexion" className="btn btn-ghost btn-lg">J&apos;ai déjà un compte</Link>
        </div>
      </section>
    </>
  );
}
