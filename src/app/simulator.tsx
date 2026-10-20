"use client";

import { useMemo, useState } from "react";
import {
  matchBuyRequest,
  REFERENCE_RATE_XOF_PER_EUR,
  type SellEurOffer,
} from "@/lib/matching";

/** Carnet d'ordres de démonstration. Données fictives, aucun utilisateur réel. */
const DEMO_BOOK: SellEurOffer[] = [
  { id: "offre-1", ownerId: "vendeur-1", eurCentsRemaining: 80_000, minRateXofPerEur: 655.957, seq: 1 },
  { id: "offre-2", ownerId: "vendeur-2", eurCentsRemaining: 40_000, minRateXofPerEur: 657, seq: 2 },
  { id: "offre-3", ownerId: "vendeur-3", eurCentsRemaining: 25_000, minRateXofPerEur: 660, seq: 3 },
  { id: "offre-4", ownerId: "vendeur-4", eurCentsRemaining: 200_000, minRateXofPerEur: 668, seq: 4 },
];

const fmtXof = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} XOF`;
const fmtEur = (cents: number) => `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

export function Simulator() {
  const [xof, setXof] = useState(1_000_000);
  const [maxRate, setMaxRate] = useState(670);

  const result = useMemo(() => {
    try {
      return { ok: true as const, value: matchBuyRequest(DEMO_BOOK, {
        id: "demande-A",
        ownerId: "demandeur-A",
        xofToSpend: Math.floor(xof),
        maxRateXofPerEur: maxRate,
      }) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Erreur inconnue" };
    }
  }, [xof, maxRate]);

  return (
    <section>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Montant à dépenser (XOF)
          <input type="number" value={xof} min={1} step={1000}
            onChange={(e) => setXof(Number(e.target.value))}
            style={{ padding: 8, fontSize: 16, width: 220 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          Taux maximum (XOF / EUR)
          <input type="number" value={maxRate} min={1} step={0.5}
            onChange={(e) => setMaxRate(Number(e.target.value))}
            style={{ padding: 8, fontSize: 16, width: 160 }} />
        </label>
        <div style={{ alignSelf: "flex-end", color: "#666", fontSize: 14 }}>
          Taux de référence : {REFERENCE_RATE_XOF_PER_EUR} XOF / EUR
        </div>
      </div>

      {!result.ok && <p style={{ color: "#b00020" }}>{result.error}</p>}

      {result.ok && (
        <>
          <h2 style={{ fontSize: "1.1rem" }}>Exécution proposée</h2>
          {result.value.fills.length === 0 ? (
            <p>Aucune offre acceptable au taux demandé.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
                  <th>Vendeur</th><th>EUR reçus</th><th>XOF payés</th><th>Taux</th>
                </tr>
              </thead>
              <tbody>
                {result.value.fills.map((f) => (
                  <tr key={f.offerId} style={{ borderBottom: "1px solid #eee" }}>
                    <td>{f.sellerId}</td>
                    <td>{fmtEur(f.eurCents)}</td>
                    <td>{fmtXof(f.xofAmount)}</td>
                    <td>{f.rateXofPerEur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p>
            <strong>Servi :</strong> {fmtXof(result.value.xofFilled)} &nbsp;·&nbsp;
            <strong>Non servi :</strong> {fmtXof(result.value.xofUnfilled)}
          </p>

          <h2 style={{ fontSize: "1.1rem" }}>Carnet d&apos;ordres après exécution</h2>
          <ul>
            {result.value.book.map((o) => (
              <li key={o.id}>
                {o.ownerId} : {fmtEur(o.eurCentsRemaining)} disponibles à partir de {o.minRateXofPerEur} XOF / EUR
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
