import { LocalDate } from "@/components/local-date";
import { fmtRate } from "@/lib/format";
import { MAX_DAILY_XOF, MAX_MONTHLY_XOF, MAX_OPEN_ORDERS, MAX_ORDER_XOF, MAX_ORDERS_PER_HOUR, RATE_BAND_PCT } from "@/lib/policy";
import { getSystemHealth } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { isInviteOnly } from "@/server/config";
import { getSql } from "@/server/db";

export const metadata = { title: "Système" };

export default async function AdminSystemPage() {
  await requireAdmin();
  const h = await getSystemHealth(getSql());

  return (
    <div className="admin-page">
      <h1 className="app-title">Système</h1>
      <section className="card">
        <div className="card-body">
          <h2 className="section-title" style={{ marginTop: 0 }}>Base de données</h2>
          <dl className="facts">
            <div><dt>Taille</dt><dd>{h.databaseSize}</dd></div>
            {h.tables.map((t) => <div key={t.name}><dt>{t.name}</dt><dd className="num">{t.rows.toLocaleString("fr-FR")} lignes</dd></div>)}
            <div><dt>Dernier événement</dt><dd>{h.lastEventAt ? <LocalDate date={h.lastEventAt} /> : "—"}</dd></div>
            <div><dt>Échecs de connexion (24 h)</dt><dd className={h.failedSignIns24h > 20 ? "warn-text" : undefined}>{h.failedSignIns24h}</dd></div>
          </dl>
        </div>
      </section>
      <section className="card">
        <div className="card-body">
          <h2 className="section-title" style={{ marginTop: 0 }}>Règles en vigueur</h2>
          <dl className="facts">
            <div><dt>Taux de référence</dt><dd>1 € = {fmtRate(h.referenceRate)} XOF</dd></div>
            <div><dt>Écart de taux autorisé</dt><dd>±{RATE_BAND_PCT} %</dd></div>
            <div><dt>Plafond par échange</dt><dd>{MAX_ORDER_XOF.toLocaleString("fr-FR")} XOF</dd></div>
            <div><dt>Plafond journalier</dt><dd>{MAX_DAILY_XOF.toLocaleString("fr-FR")} XOF</dd></div>
            <div><dt>Plafond mensuel</dt><dd>{MAX_MONTHLY_XOF.toLocaleString("fr-FR")} XOF</dd></div>
            <div><dt>Demandes ouvertes / échanges par heure</dt><dd>{MAX_OPEN_ORDERS} / {MAX_ORDERS_PER_HOUR}</dd></div>
            <div><dt>Inscription</dt><dd>{isInviteOnly() ? "Sur invitation" : "Ouverte à tous"}</dd></div>
          </dl>
          <p className="field-hint" style={{ margin: "8px 0 0" }}>
            Ces règles se modifient dans le code (src/lib/policy.ts) puis par un déploiement, pour qu&apos;elles restent
            testées et tracées dans l&apos;historique.
          </p>
        </div>
      </section>
    </div>
  );
}
