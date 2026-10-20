import Link from "next/link";
import { fmtEur, fmtRate, fmtXof, rateGap } from "@/lib/format";
import { isBackendConfigured } from "@/server/config";
import { getSql } from "@/server/db";
import { getMarketSnapshot, type MarketSnapshot } from "@/server/queries";

// Le marché change à chaque ordre : la page est rendue à chaque visite.
export const dynamic = "force-dynamic";

async function loadMarket(): Promise<MarketSnapshot | null> {
  if (!isBackendConfigured()) return null;
  try {
    return await getMarketSnapshot(getSql());
  } catch (error) {
    console.error("Lecture du marché impossible", error);
    return null;
  }
}

export default async function HomePage() {
  const market = await loadMarket();

  return (
    <>
      <section className="hero-block">
        <h1>Échangez vos euros et vos francs CFA entre particuliers.</h1>
        <p className="lead">
          Vous fixez votre taux. Mosaik trouve une ou plusieurs personnes qui font l&apos;échange
          inverse, et vous n&apos;obtenez jamais moins bien que le taux que vous avez choisi.
        </p>
        <div className="cta-row">
          <Link href="/connexion" className="btn btn-primary btn-lg">Rejoindre le pilote</Link>
          <Link href="/simulateur" className="btn btn-secondary btn-lg">Essayer le simulateur</Link>
        </div>
      </section>

      <section className="market" aria-labelledby="market-title">
        <h2 id="market-title" className="section-title">Le marché en ce moment</h2>
        {market ? (
          <div className="market-grid">
            <MarketCard
              title="Pour obtenir des euros"
              rate={market.bestEurOffer}
              hint="meilleur taux proposé par les vendeurs d'euros"
              volume={market.eurAvailableCents > 0 ? `${fmtEur(market.eurAvailableCents)} disponibles` : null}
            />
            <MarketCard
              title="Pour obtenir des XOF"
              rate={market.bestXofOffer}
              hint="meilleur taux proposé par les vendeurs de XOF"
              volume={market.xofAvailable > 0 ? `${fmtXof(market.xofAvailable)} disponibles` : null}
            />
          </div>
        ) : (
          <div className="notice info" style={{ marginTop: 0 }}>
            Le pilote ouvre bientôt. En attendant, le simulateur montre comment un échange est réparti
            entre plusieurs personnes.
          </div>
        )}
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="section-title">Comment ça marche</h2>
        <ol className="steps">
          <li>
            <strong>Vous passez un ordre.</strong> Le montant que vous voulez échanger et votre taux
            limite : le minimum que vous acceptez, ou le maximum que vous êtes prêt à donner.
          </li>
          <li>
            <strong>Mosaik l&apos;apparie.</strong> Votre ordre est servi par une ou plusieurs
            personnes, les meilleurs taux d&apos;abord. Ce qui n&apos;est pas servi attend dans le
            carnet à votre taux.
          </li>
          <li>
            <strong>Vous réglez directement.</strong> Pour chaque échange, Mosaik vous indique combien
            envoyer et à qui. Celui dont l&apos;ordre est arrivé en dernier paie en premier ; chacun
            confirme l&apos;envoi puis la réception, dans les 24 heures.
          </li>
        </ol>
      </section>

      <section aria-labelledby="trust-title">
        <h2 id="trust-title" className="section-title">Nos engagements</h2>
        <ul className="pledges">
          <li><strong>Jamais au-delà de votre taux.</strong> Chaque échange se fait au taux affiché ou mieux pour vous.</li>
          <li><strong>Calcul exact.</strong> Montants en centimes et en XOF entiers ; l&apos;écart d&apos;arrondi reste inférieur à 1 XOF par échange, et tout reste est affiché.</li>
          <li><strong>Pas de fonds détenus.</strong> Pendant le pilote, Mosaik ne reçoit ni ne transfère d&apos;argent.</li>
          <li>
            <strong>Discrétion.</strong> Votre adresse e-mail n&apos;est jamais affichée ; vos coordonnées de
            paiement ne sont transmises qu&apos;à vos contreparties, pour l&apos;échange concerné.
          </li>
        </ul>
      </section>
    </>
  );
}

function MarketCard({ title, rate, hint, volume }: { title: string; rate: number | null; hint: string; volume: string | null }) {
  return (
    <div className="card market-card">
      <div className="stat-label">{title}</div>
      {rate !== null ? (
        <>
          <div className="market-rate num">{fmtRate(rate)} <span>XOF / €</span></div>
          <div className="stat-sub">{hint}</div>
          <div className="stat-sub">{rateGap(rate)}</div>
          {volume && <div className="stat-sub num">{volume}</div>}
        </>
      ) : (
        <div className="stat-sub" style={{ marginTop: 8 }}>Aucune offre pour le moment.</div>
      )}
    </div>
  );
}
