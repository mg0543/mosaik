import type { Metadata } from "next";
import Link from "next/link";
import { StepIcon } from "@/components/illustrations";
import { LocalDate } from "@/components/local-date";
import { OrderListItem } from "@/components/orders";
import { fmtEur, fmtEurNumber, fmtRate, fmtXof, fmtXofNumber } from "@/lib/format";
import { marketOffers } from "@/lib/offers";
import { MAX_DAILY_XOF, MAX_MONTHLY_XOF, remainingAllowance } from "@/lib/policy";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { getVolumeUsage } from "@/server/orders";
import { getProfile } from "@/server/profiles";
import { getBookForUser, getMyOrders } from "@/server/queries";
import { getPendingActions } from "@/server/settlements";

export const metadata: Metadata = { title: "Activité" };

/**
 * Onglet Activité : ce qui attend l'utilisateur, ses limites et tous ses échanges.
 * Le convertisseur est dans l'onglet Envoyer.
 */
export default async function ActivityPage() {
  const user = await requireUser();
  const sql = getSql();
  const [orders, toDo, profile, book, usage] = await Promise.all([
    getMyOrders(sql, user.id, 100),
    getPendingActions(sql, user.id),
    getProfile(sql, user.id),
    getBookForUser(sql, user.id),
    getVolumeUsage(sql, user.id),
  ]);
  const inProgress = orders.filter((o) => o.status === "open").length;
  const completed = orders.filter((o) => o.status === "filled").length;
  const offers = marketOffers(book);
  const openOrders = orders.filter((o) => o.status === "open");
  const closedOrders = orders.filter((o) => o.status !== "open");

  return (
    <div className="app-page">
      <div>
        <h1 className="app-title">Activité</h1>
        <p className="muted app-subtitle-plain">
          {profile.firstName ? `${profile.firstName}, voici` : "Voici"} où en sont vos échanges.
        </p>
      </div>

      {toDo.length > 0 ? (
        <section className="todo-banner" aria-labelledby="todo-title">
          <h2 id="todo-title">À faire ({toDo.length})</h2>
          <ul className="todo-list">
            {toDo.map((a) => (
              <li key={a.tradeId}>
                <Link href={`/app/ordres/${a.orderId}#echanges`}>
                  <strong>
                    {a.step === "taker_sent" || a.step === "maker_sent" ? "Envoyer votre paiement" : "Confirmer une réception"}
                  </strong>
                  <span className="muted"> · avant le <LocalDate date={a.dueAt} /></span>
                  <span className="todo-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="calm-banner">
          <StepIcon name="settle" />
          <p>Rien à faire pour l&apos;instant : aucun paiement ne vous attend.</p>
        </section>
      )}

      <section className="card" aria-labelledby="offers-title">
        <div className="card-body">
          <h2 id="offers-title" className="section-title" style={{ marginTop: 0 }}>Offres disponibles</h2>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>
            Choisissez une offre : le convertisseur s&apos;ouvre à son montant et à son taux. Vous pourrez ajuster le montant.
          </p>
          <OfferGroup title="Pour recevoir des francs CFA" empty="Aucune offre de francs CFA pour le moment."
            offers={offers.forXof.map((o) => ({
              key: o.seq, headline: `${fmtXof(o.available)} disponibles`, rate: o.rate,
              cta: `Envoyer ${fmtEur(o.takerAmount)}`,
              href: `/app?${new URLSearchParams({ sens: o.takerSide, montant: fmtEurNumber(o.takerAmount), taux: fmtRate(o.rate) })}`,
            }))} />
          <OfferGroup title="Pour recevoir des euros" empty="Aucune offre d'euros pour le moment."
            offers={offers.forEur.map((o) => ({
              key: o.seq, headline: `${fmtEur(o.available)} disponibles`, rate: o.rate,
              cta: `Envoyer ${fmtXof(o.takerAmount)}`,
              href: `/app?${new URLSearchParams({ sens: o.takerSide, montant: fmtXofNumber(o.takerAmount), taux: fmtRate(o.rate) })}`,
            }))} />
        </div>
      </section>

      <section className="card" aria-labelledby="limits-title">
        <div className="card-body">
          <h2 id="limits-title" className="section-title" style={{ marginTop: 0 }}>Mes limites</h2>
          <Gauge label="Aujourd'hui" used={usage.today} max={MAX_DAILY_XOF} />
          <Gauge label="Ce mois-ci" used={usage.month} max={MAX_MONTHLY_XOF} />
          <p className="field-hint" style={{ margin: "8px 0 0" }}>
            Vous pouvez encore échanger <strong className="num">{fmtXofNumber(remainingAllowance(usage))} XOF</strong> aujourd&apos;hui
            (ou l&apos;équivalent en euros). Ces plafonds suivent les limites des comptes mobile money fixées par la BCEAO.
          </p>
        </div>
      </section>

      <section className="stats" aria-label="Mes chiffres">
        <div className="stat-tile"><strong className="num">{inProgress}</strong><span>en cours</span></div>
        <div className="stat-tile"><strong className="num">{completed}</strong><span>terminés</span></div>
        <div className="stat-tile"><strong className="num">{toDo.length}</strong><span>à faire</span></div>
      </section>

      <section aria-labelledby="open-title">
        <h2 id="open-title" className="section-title">En cours ({openOrders.length})</h2>
        {orders.length === 0 ? (
          <div className="empty-state card">
            <p><strong>Aucun échange pour l&apos;instant.</strong></p>
            <Link href="/app" className="btn btn-secondary">Faire mon premier échange</Link>
          </div>
        ) : openOrders.length === 0 ? (
          <p className="muted">Aucune demande en attente.</p>
        ) : (
          <ul className="order-list">{openOrders.map((o) => <OrderListItem key={o.id} order={o} />)}</ul>
        )}
      </section>

      {closedOrders.length > 0 && (
        <section aria-labelledby="closed-title">
          <h2 id="closed-title" className="section-title">Terminés ({closedOrders.length})</h2>
          <ul className="order-list">{closedOrders.map((o) => <OrderListItem key={o.id} order={o} />)}</ul>
        </section>
      )}
    </div>
  );
}

/** Jauge d'un plafond : déjà engagé sur maximum autorisé. */
function Gauge({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, (used / max) * 100);
  return (
    <div className="gauge">
      <div className="gauge-head">
        <span>{label}</span>
        <span className="num">{fmtXofNumber(used)} / {fmtXofNumber(max)} XOF</span>
      </div>
      <div className="progress" role="img" aria-label={`${label} : ${fmtXofNumber(used)} XOF sur ${fmtXofNumber(max)}`}>
        <div style={{ width: `${pct}%` }} className={pct >= 90 ? "near-limit" : undefined} />
      </div>
    </div>
  );
}

/** Un groupe d'offres : montant disponible, taux, et bouton qui ouvre le convertisseur prérempli. */
function OfferGroup({
  title,
  empty,
  offers,
}: {
  title: string;
  empty: string;
  offers: { key: number; headline: string; rate: number; cta: string; href: string }[];
}) {
  return (
    <div className="offer-group">
      <h3>{title}</h3>
      {offers.length === 0 ? (
        <p className="muted offer-empty">{empty}</p>
      ) : (
        <ul className="offer-list">
          {offers.map((o, i) => (
            <li key={o.key} className="offer">
              <div>
                <strong className="num">{o.headline}</strong>
                <span className="muted num">1 € = {fmtRate(o.rate)} XOF{i === 0 ? " · meilleur taux" : ""}</span>
              </div>
              <Link href={o.href} className="btn btn-primary btn-sm">{o.cta}</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
