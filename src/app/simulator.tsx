"use client";

import { useMemo, useState } from "react";
import {
  matchBuyRequest,
  REFERENCE_RATE_XOF_PER_EUR,
  type MatchResult,
  type SellEurOffer,
} from "@/lib/matching";

/** Carnet d'ordres de départ. Données fictives, aucun utilisateur réel. */
const INITIAL_BOOK: SellEurOffer[] = [
  { id: "offre-1", ownerId: "vendeur-1", eurCentsRemaining: 80_000, minRateXofPerEur: 655.957, seq: 1 },
  { id: "offre-2", ownerId: "vendeur-2", eurCentsRemaining: 40_000, minRateXofPerEur: 657, seq: 2 },
  { id: "offre-3", ownerId: "vendeur-3", eurCentsRemaining: 25_000, minRateXofPerEur: 660, seq: 3 },
  { id: "offre-4", ownerId: "vendeur-4", eurCentsRemaining: 200_000, minRateXofPerEur: 668, seq: 4 },
];

const fmtXof = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} XOF`;
const fmtEur = (cents: number) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;

const inputStyle = { padding: 8, fontSize: 16, width: 180 } as const;
const labelStyle = { display: "flex", flexDirection: "column", gap: 4 } as const;
const buttonStyle = {
  padding: "8px 16px",
  fontSize: 15,
  background: "#1a1a1a",
  color: "#fff",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
} as const;

export function Simulator() {
  const [book, setBook] = useState<SellEurOffer[]>(INITIAL_BOOK);
  // Numéro d'ordre unique, utilisé pour l'identifiant, le nom et l'ordre d'arrivée.
  const [nextSeq, setNextSeq] = useState(INITIAL_BOOK.length + 1);

  // Demande
  const [xof, setXof] = useState(1_000_000);
  const [maxRate, setMaxRate] = useState(670);

  // Nouvelle offre (vendre des EUR)
  const [offerEur, setOfferEur] = useState(500);
  const [offerMinRate, setOfferMinRate] = useState(660);
  const [offerError, setOfferError] = useState<string | null>(null);

  // Dernière exécution exécutée (pour affichage)
  const [lastExecution, setLastExecution] = useState<MatchResult | null>(null);

  const preview = useMemo<{ ok: true; value: MatchResult } | { ok: false; error: string }>(() => {
    try {
      return {
        ok: true,
        value: matchBuyRequest(book, {
          id: "demande",
          ownerId: "demandeur",
          xofToSpend: Math.floor(xof),
          maxRateXofPerEur: maxRate,
        }),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
    }
  }, [book, xof, maxRate]);

  function addOffer() {
    const eurCents = Math.round(offerEur * 100);
    if (!Number.isFinite(eurCents) || eurCents <= 0) {
      setOfferError("Le montant en EUR doit être positif.");
      return;
    }
    if (!Number.isFinite(offerMinRate) || offerMinRate <= 0) {
      setOfferError("Le taux minimum doit être positif.");
      return;
    }
    setOfferError(null);
    setBook((prev) => [
      ...prev,
      {
        id: `offre-${nextSeq}`,
        ownerId: `vendeur-${nextSeq}`,
        eurCentsRemaining: eurCents,
        minRateXofPerEur: offerMinRate,
        seq: nextSeq,
      },
    ]);
    setNextSeq((s) => s + 1);
  }

  function executeRequest() {
    if (!preview.ok) return;
    setLastExecution(preview.value);
    setBook(preview.value.book);
  }

  function resetBook() {
    setBook(INITIAL_BOOK);
    setNextSeq(INITIAL_BOOK.length + 1);
    setLastExecution(null);
  }

  return (
    <section>
      {/* Demande */}
      <h2 style={{ fontSize: "1.1rem" }}>1. Demande d&apos;achat d&apos;EUR</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        <label style={labelStyle}>
          Montant à dépenser (XOF)
          <input type="number" value={xof} min={1} step={1000}
            onChange={(e) => setXof(Number(e.target.value))} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Taux maximum (XOF / EUR)
          <input type="number" value={maxRate} min={1} step={0.5}
            onChange={(e) => setMaxRate(Number(e.target.value))} style={inputStyle} />
        </label>
        <div style={{ alignSelf: "flex-end", color: "#666", fontSize: 14 }}>
          Référence : {REFERENCE_RATE_XOF_PER_EUR} XOF / EUR
        </div>
      </div>

      {!preview.ok && <p style={{ color: "#b00020" }}>{preview.error}</p>}

      {preview.ok && (
        <>
          <h3 style={{ fontSize: "1rem" }}>Exécution proposée</h3>
          {preview.value.fills.length === 0 ? (
            <p>Aucune offre acceptable au taux demandé.</p>
          ) : (
            <FillsTable result={preview.value} />
          )}
          <p>
            <strong>Servi :</strong> {fmtXof(preview.value.xofFilled)} &nbsp;·&nbsp;
            <strong>Non servi :</strong> {fmtXof(preview.value.xofUnfilled)}
          </p>
          <button type="button" onClick={executeRequest} disabled={preview.value.fills.length === 0}
            style={{ ...buttonStyle, opacity: preview.value.fills.length === 0 ? 0.4 : 1 }}>
            Exécuter cette demande
          </button>
        </>
      )}

      {/* Nouvelle offre */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>2. Proposer des EUR à la vente</h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={labelStyle}>
          Montant d&apos;EUR à vendre
          <input type="number" value={offerEur} min={1} step={10}
            onChange={(e) => setOfferEur(Number(e.target.value))} style={inputStyle} />
        </label>
        <label style={labelStyle}>
          Taux minimum accepté (XOF / EUR)
          <input type="number" value={offerMinRate} min={1} step={0.5}
            onChange={(e) => setOfferMinRate(Number(e.target.value))} style={inputStyle} />
        </label>
        <button type="button" onClick={addOffer} style={buttonStyle}>Ajouter l&apos;offre</button>
      </div>
      {offerError && <p style={{ color: "#b00020" }}>{offerError}</p>}

      {/* Carnet */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>Carnet d&apos;ordres</h2>
      {book.length === 0 ? (
        <p>Le carnet est vide.</p>
      ) : (
        <ul>
          {book.map((o) => (
            <li key={o.id}>
              {o.ownerId} : {fmtEur(o.eurCentsRemaining)} disponibles à partir de {o.minRateXofPerEur} XOF / EUR
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={resetBook} style={{ ...buttonStyle, background: "#777" }}>
        Réinitialiser les données de démonstration
      </button>

      {/* Dernière exécution */}
      {lastExecution && (
        <div style={{ marginTop: "2rem", padding: 12, background: "#eef7ee", borderRadius: 4 }}>
          <strong>Dernière exécution (simulation) :</strong> {fmtXof(lastExecution.xofFilled)} servis
          à travers {lastExecution.fills.length} vendeur(s). Aucun paiement réel n&apos;a été effectué.
        </div>
      )}
    </section>
  );
}

function FillsTable({ result }: { result: MatchResult }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
          <th>Vendeur</th><th>EUR reçus</th><th>XOF payés</th><th>Taux</th>
        </tr>
      </thead>
      <tbody>
        {result.fills.map((f) => (
          <tr key={f.offerId} style={{ borderBottom: "1px solid #eee" }}>
            <td>{f.sellerId}</td>
            <td>{fmtEur(f.eurCents)}</td>
            <td>{fmtXof(f.xofAmount)}</td>
            <td>{f.rateXofPerEur}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
