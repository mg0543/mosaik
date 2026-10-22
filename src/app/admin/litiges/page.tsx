import { LocalDate } from "@/components/local-date";
import { fmtEur, fmtXof } from "@/lib/format";
import { listDisputes } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { getSql } from "@/server/db";
import { resolveDisputeAction } from "../actions";
import { AdminForm } from "../forms";

export const metadata = { title: "Litiges" };

const money = (currency: "EUR" | "XOF", amount: number) => (currency === "EUR" ? fmtEur(amount) : fmtXof(amount));

export default async function AdminDisputesPage() {
  await requireAdmin();
  const disputes = await listDisputes(getSql());
  const open = disputes.filter((d) => !d.resolvedAt).length;

  return (
    <div className="admin-page">
      <h1 className="app-title">Litiges ({open} à trancher)</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Un règlement en litige est gelé. Votre décision est définitive et notifiée aux deux partenaires.
      </p>
      {disputes.length === 0 ? (
        <div className="empty-state card"><p>Aucun litige.</p></div>
      ) : (
        <ul className="admin-list">
          {disputes.map((d) => {
            const makerCurrency = d.takerCurrency === "EUR" ? "XOF" : "EUR";
            return (
              <li key={d.tradeId} className={d.resolvedAt ? "admin-row" : "admin-row urgent"}>
                <div className="admin-row-main">
                  <strong>Réf. {d.tradeId.slice(0, 8).toUpperCase()}</strong>
                  {d.resolvedAt
                    ? <span className={`chip ${d.resolution === "completed" ? "chip-done" : "chip-off"}`}>{d.resolution === "completed" ? "Réglé" : "Échoué"}</span>
                    : <span className="chip chip-late">À trancher</span>}
                  <span>« {d.reason} »</span>
                  <span className="muted admin-meta">
                    Signalé par {d.disputedByEmail} le <LocalDate date={d.disputedAt} />
                  </span>
                  <span className="muted admin-meta">
                    Preneur {d.takerEmail} doit {money(d.takerCurrency, d.takerAmount)} · faiseur {d.makerEmail} doit{" "}
                    {money(makerCurrency, d.makerAmount)}
                  </span>
                  <span className="muted admin-meta">
                    Étapes : envoi du preneur {d.steps.takerSent ? "✓" : "✗"} · réception {d.steps.makerReceived ? "✓" : "✗"} · envoi
                    du faiseur {d.steps.makerSent ? "✓" : "✗"}
                  </span>
                  {d.resolutionNote && <span className="muted">Décision : {d.resolutionNote}</span>}
                </div>
                {!d.resolvedAt && (
                  <div className="admin-row-actions">
                    <AdminForm action={resolveDisputeAction} hidden={{ tradeId: d.tradeId }} label="Enregistrer la décision" confirm="Trancher">
                      <select name="resolution" required defaultValue="" className="admin-input" aria-label="Décision">
                        <option value="" disabled>Décision…</option>
                        <option value="completed">Réglé : les paiements ont eu lieu</option>
                        <option value="failed">Échoué : un paiement manque</option>
                      </select>
                      <textarea name="note" required minLength={3} maxLength={1000} rows={2} className="admin-input"
                        placeholder="Explication (communiquée aux deux partenaires)" aria-label="Explication" />
                    </AdminForm>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
