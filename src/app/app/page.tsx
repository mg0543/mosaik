import type { Metadata } from "next";
import Link from "next/link";
import { Converter } from "@/components/converter";
import { OrderListItem } from "@/components/orders";
import type { Side } from "@/lib/matching";
import { payToFor } from "@/lib/payment";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getVolumeUsage } from "@/server/orders";
import { getProfile } from "@/server/profiles";
import { getBookForUser, getMyOrders } from "@/server/queries";
import { getPaymentDetails, getPendingActions } from "@/server/settlements";

export const metadata: Metadata = { title: "Accueil" };

/** Préremplissage depuis une offre choisie dans Activité (?sens=…&montant=…&taux=…). */
function readInitial(params: { sens?: string; montant?: string; taux?: string }) {
  const side: Side | null = params.sens === "SELL_EUR" || params.sens === "SELL_XOF" ? params.sens : null;
  if (!side || !params.montant || params.montant.length > 20) return undefined;
  return { side, amount: params.montant, rate: params.taux && params.taux.length <= 12 ? params.taux : undefined };
}

/** Accueil : comme une application de transfert, on arrive directement sur « combien j'envoie ». */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ sens?: string; montant?: string; taux?: string }> }) {
  const user = await requireUser();
  const sql = getSql();
  const [book, details, usage, profile, toDo, orders, params] = await Promise.all([
    getBookForUser(sql, user.id),
    getPaymentDetails(sql, user.id),
    getVolumeUsage(sql, user.id),
    getProfile(sql, user.id),
    getPendingActions(sql, user.id),
    getMyOrders(sql, user.id, 3),
    searchParams,
  ]);
  // Pour échanger, il faut pouvoir être payé dans la devise reçue.
  const canReceive = { SELL_XOF: payToFor(details, "EUR") !== null, SELL_EUR: payToFor(details, "XOF") !== null };
  const initial = readInitial(params);

  return (
    <div className="app-page">
      <div>
        <h1 className="app-title">Bonjour{profile.firstName ? ` ${profile.firstName}` : ""} 👋</h1>
        <p className="muted app-subtitle-plain">Combien voulez-vous envoyer ?</p>
      </div>

      {toDo.length > 0 && (
        <Link href="/app/activite" className="action-banner">
          <span className="action-dot" aria-hidden="true" />
          <span>
            <strong>{toDo.length} paiement{toDo.length > 1 ? "s attendent" : " attend"} votre action</strong> dans
            Activité.
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <section className="card converter-card" aria-label="Nouvel échange">
        <div className="card-body">
          {/* La clé force un nouveau convertisseur quand on arrive depuis une autre offre. */}
          <Converter key={initial ? `${initial.side}-${initial.amount}-${initial.rate}` : "vide"} book={book} mode="app"
            canReceive={canReceive} usage={usage} initial={initial} />
        </div>
      </section>

      <section aria-labelledby="recent-title">
        <div className="section-head">
          <h2 id="recent-title" className="section-title">Derniers échanges</h2>
          {orders.length > 0 && <Link href="/app/activite" className="link-more">Toute l&apos;activité</Link>}
        </div>
        {orders.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Vos échanges apparaîtront ici.</p>
        ) : (
          <ul className="order-list">{orders.map((o) => <OrderListItem key={o.id} order={o} />)}</ul>
        )}
      </section>
    </div>
  );
}
