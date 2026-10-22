import type { Metadata } from "next";
import Link from "next/link";
import { Converter } from "@/components/converter";
import { Flag } from "@/components/flags";
import { countryFromPhone } from "@/lib/countries";
import { fmtGiven, fmtRelative, sideLabel } from "@/lib/format";
import type { Side } from "@/lib/matching";
import { orderStatus } from "@/lib/order-status";
import { maskIban, maskPhone, payToFor, XOF_OPERATORS } from "@/lib/payment";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { unreadCount } from "@/server/notifications";
import { getVolumeUsage } from "@/server/orders";
import { getProfile } from "@/server/profiles";
import { getBookForUser, getMyOrders, type MyOrder } from "@/server/queries";
import { isSuperAdmin } from "@/server/roles";
import { getPaymentDetails, getPendingActions } from "@/server/settlements";
import { Bell } from "./bell";

export const metadata: Metadata = { title: "Accueil" };

/** Préremplissage depuis une offre choisie dans Activité (?sens=…&montant=…&taux=…). */
function readInitial(params: { sens?: string; montant?: string; taux?: string }) {
  const side: Side | null = params.sens === "SELL_EUR" || params.sens === "SELL_XOF" ? params.sens : null;
  if (!side || !params.montant || params.montant.length > 20) return undefined;
  return { side, amount: params.montant, rate: params.taux && params.taux.length <= 12 ? params.taux : undefined };
}

/** Accueil, sur le modèle des applications de transfert : combien j'envoie, mes comptes, mon activité. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ sens?: string; montant?: string; taux?: string }> }) {
  const user = await requireUser();
  const sql = getSql();
  const [book, details, usage, profile, toDo, orders, unread, admin, params] = await Promise.all([
    getBookForUser(sql, user.id),
    getPaymentDetails(sql, user.id),
    getVolumeUsage(sql, user.id),
    getProfile(sql, user.id),
    getPendingActions(sql, user.id),
    getMyOrders(sql, user.id, 5),
    unreadCount(sql, user.id),
    isSuperAdmin(sql, user.id),
    searchParams,
  ]);
  const canReceive = { SELL_XOF: payToFor(details, "EUR") !== null, SELL_EUR: payToFor(details, "XOF") !== null };
  const initial = readInitial(params);
  const initials = ([profile.firstName?.[0], profile.lastName?.[0]].filter(Boolean).join("") || user.email[0]).toUpperCase();
  const country = countryFromPhone(details.xofPhone ?? profile.phone);
  const now = new Date();

  return (
    <div className="home">
      <section className="home-hero" aria-label="Nouvel échange">
        <div className="home-top">
          <Link href="/app/compte" className="avatar-chip" aria-label="Mon compte">{initials}</Link>
          <h1 className="home-greeting">Bonjour{profile.firstName ? ` ${profile.firstName}` : ""}</h1>
          <div className="header-tools">
            {admin && <Link href="/admin" className="admin-link">Admin</Link>}
            <Bell unread={unread} />
          </div>
        </div>
        {/* La clé recrée le convertisseur quand on arrive depuis une autre offre. */}
        <Converter key={initial ? `${initial.side}-${initial.amount}-${initial.rate}` : "vide"} book={book} mode="app"
          variant="hero" country={country} canReceive={canReceive} usage={usage} initial={initial} />
      </section>

      {toDo.length > 0 && (
        <Link href="/app/activite" className="action-banner">
          <span className="action-dot" aria-hidden="true" />
          <span>
            <strong>{toDo.length} paiement{toDo.length > 1 ? "s attendent" : " attend"} votre action</strong>
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <section aria-labelledby="accounts-title">
        <h2 id="accounts-title" className="home-title">Mes comptes de réception</h2>
        <p className="home-sub">Là où vos partenaires vous paient. MEYA ne détient jamais votre argent.</p>
        <div className="account-cards">
          <Link href="/app/compte" className="account-card">
            <Flag code="EU" size={34} />
            <span className="account-currency">EUR</span>
            {details.eurIban
              ? <><strong className="num">{maskIban(details.eurIban)}</strong><span className="muted">{details.eurHolder}</span></>
              : <><strong>Ajouter un IBAN</strong><span className="muted">pour recevoir des euros</span></>}
          </Link>
          <Link href="/app/compte" className="account-card">
            {country ? <Flag code={country} size={34} /> : <span className="cfa-coin big" aria-hidden="true">CFA</span>}
            <span className="account-currency">XOF</span>
            {details.xofPhone && details.xofOperator
              ? <><strong className="num">{maskPhone(details.xofPhone)}</strong><span className="muted">{XOF_OPERATORS[details.xofOperator]}</span></>
              : <><strong>Ajouter un numéro</strong><span className="muted">pour recevoir des francs CFA</span></>}
          </Link>
          <Link href="/app/compte" className="account-card add">
            <span className="add-icon" aria-hidden="true">+</span>
            <strong>Gérer</strong>
          </Link>
        </div>
      </section>

      <section aria-labelledby="activity-title">
        <div className="section-head">
          <h2 id="activity-title" className="home-title">Activité</h2>
          {orders.length > 0 && <Link href="/app/activite" className="link-more">Tout voir</Link>}
        </div>
        {orders.length === 0 ? (
          <p className="home-sub">Vos échanges apparaîtront ici.</p>
        ) : (
          <ul className="activity-rows">
            {orders.map((o) => <ActivityRow key={o.id} order={o} now={now} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Ligne d'activité : icône d'état, sens, statut, montant et date relative. */
function ActivityRow({ order, now }: { order: MyOrder; now: Date }) {
  const status = orderStatus(order);
  const icon = status.tone === "done" ? "✓" : status.tone === "off" ? "✕" : status.tone === "partial" ? "◐" : "…";
  return (
    <li>
      <Link href={`/app/ordres/${order.id}`} className="activity-row">
        <span className={`activity-icon ${status.tone}`} aria-hidden="true">{icon}</span>
        <span className="activity-main">
          <strong>{sideLabel(order.side)}</strong>
          <span>{status.label}</span>
        </span>
        <span className="activity-side">
          <strong className="num">{fmtGiven(order.side, order.amount)}</strong>
          <span>{fmtRelative(order.createdAt, now)}</span>
        </span>
      </Link>
    </li>
  );
}
