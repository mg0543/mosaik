"use client";

import { useMemo, useState } from "react";
import {
  eurCentsForXof,
  matchBuyRequest,
  matchBuyXofRequest,
  REFERENCE_RATE_XOF_PER_EUR,
  type Fill,
  type MatchResult,
  type SellEurOffer,
  type SellXofOffer,
  type XofMatchResult,
} from "@/lib/matching";

/** Sens de l'échange vu par le demandeur. */
type Direction = "buyEur" | "buyXof";

/** Carnets de départ. Données fictives, aucun utilisateur réel. */
const INITIAL_EUR_BOOK: SellEurOffer[] = [
  { id: "offre-1", ownerId: "vendeur-1", eurCentsRemaining: 80_000, minRateXofPerEur: 655.957, seq: 1 },
  { id: "offre-2", ownerId: "vendeur-2", eurCentsRemaining: 40_000, minRateXofPerEur: 657, seq: 2 },
  { id: "offre-3", ownerId: "vendeur-3", eurCentsRemaining: 25_000, minRateXofPerEur: 660, seq: 3 },
  { id: "offre-4", ownerId: "vendeur-4", eurCentsRemaining: 200_000, minRateXofPerEur: 668, seq: 4 },
];

const INITIAL_XOF_BOOK: SellXofOffer[] = [
  { id: "offre-5", ownerId: "vendeur-5", xofRemaining: 300_000, maxRateXofPerEur: 655.957, seq: 5 },
  { id: "offre-6", ownerId: "vendeur-6", xofRemaining: 500_000, maxRateXofPerEur: 654, seq: 6 },
  { id: "offre-7", ownerId: "vendeur-7", xofRemaining: 200_000, maxRateXofPerEur: 652, seq: 7 },
  { id: "offre-8", ownerId: "vendeur-8", xofRemaining: 1_500_000, maxRateXofPerEur: 645, seq: 8 },
];

const INITIAL_NEXT_SEQ = INITIAL_EUR_BOOK.length + INITIAL_XOF_BOOK.length + 1;

const fmtXof = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} XOF`;
const fmtEur = (cents: number) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €`;
/** Conversion d'une saisie en euros vers des centimes entiers (corrige 1.13 * 100 = 112.999…). */
const toCents = (eur: number) => Math.round(eur * 100);

/** Une offre de XOF dont le reste ne vaut pas 1 centime à son taux n'est plus appariable. */
const isXofDust = (o: SellXofOffer) => eurCentsForXof(o.xofRemaining, o.maxRateXofPerEur) === 0;

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
const warningStyle = { color: "#8a5a00" } as const;

type Preview =
  | { ok: true; direction: "buyEur"; value: MatchResult }
  | { ok: true; direction: "buyXof"; value: XofMatchResult }
  | { ok: false; error: string };

type Execution =
  | { direction: "buyEur"; value: MatchResult }
  | { direction: "buyXof"; value: XofMatchResult };

export function Simulator() {
  const [direction, setDirection] = useState<Direction>("buyEur");
  const [eurBook, setEurBook] = useState<SellEurOffer[]>(INITIAL_EUR_BOOK);
  const [xofBook, setXofBook] = useState<SellXofOffer[]>(INITIAL_XOF_BOOK);
  // Numéro d'ordre unique (partagé par les deux carnets), utilisé pour l'identifiant,
  // le nom et l'ordre d'arrivée.
  const [nextSeq, setNextSeq] = useState(INITIAL_NEXT_SEQ);

  // Demande : achat d'EUR (on dépense des XOF)
  const [xof, setXof] = useState(1_000_000);
  const [maxRate, setMaxRate] = useState(670);
  // Demande : achat de XOF (on dépense des EUR)
  const [eur, setEur] = useState(1000);
  const [minRate, setMinRate] = useState(650);

  // Nouvelle offre : vendre des EUR
  const [offerEur, setOfferEur] = useState(500);
  const [offerMinRate, setOfferMinRate] = useState(660);
  // Nouvelle offre : vendre des XOF
  const [offerXof, setOfferXof] = useState(300_000);
  const [offerMaxRate, setOfferMaxRate] = useState(652);
  const [offerError, setOfferError] = useState<string | null>(null);

  // Dernière exécution (pour affichage)
  const [lastExecution, setLastExecution] = useState<Execution | null>(null);

  const preview = useMemo<Preview>(() => {
    try {
      if (direction === "buyEur") {
        return {
          ok: true,
          direction,
          value: matchBuyRequest(eurBook, {
            id: "demande",
            ownerId: "demandeur",
            xofToSpend: Math.floor(xof),
            maxRateXofPerEur: maxRate,
          }),
        };
      }
      return {
        ok: true,
        direction,
        value: matchBuyXofRequest(xofBook, {
          id: "demande",
          ownerId: "demandeur",
          eurCentsToSpend: toCents(eur),
          minRateXofPerEur: minRate,
        }),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
    }
  }, [direction, eurBook, xofBook, xof, maxRate, eur, minRate]);

  function changeDirection(next: Direction) {
    setDirection(next);
    setOfferError(null);
  }

  function addOffer() {
    if (direction === "buyEur") {
      // Le demandeur achète des EUR : les offres sont des ventes d'EUR.
      const eurCents = toCents(offerEur);
      if (!Number.isFinite(eurCents) || eurCents <= 0) {
        setOfferError("Le montant en EUR doit être positif.");
        return;
      }
      if (!Number.isFinite(offerMinRate) || offerMinRate <= 0) {
        setOfferError("Le taux minimum doit être positif.");
        return;
      }
      setEurBook((prev) => [
        ...prev,
        {
          id: `offre-${nextSeq}`,
          ownerId: `vendeur-${nextSeq}`,
          eurCentsRemaining: eurCents,
          minRateXofPerEur: offerMinRate,
          seq: nextSeq,
        },
      ]);
    } else {
      // Le demandeur achète des XOF : les offres sont des ventes de XOF.
      const xofAmount = Math.floor(offerXof);
      if (!Number.isFinite(xofAmount) || xofAmount <= 0) {
        setOfferError("Le montant en XOF doit être positif.");
        return;
      }
      if (!Number.isFinite(offerMaxRate) || offerMaxRate <= 0) {
        setOfferError("Le taux maximum doit être positif.");
        return;
      }
      setXofBook((prev) => [
        ...prev,
        {
          id: `offre-${nextSeq}`,
          ownerId: `vendeur-${nextSeq}`,
          xofRemaining: xofAmount,
          maxRateXofPerEur: offerMaxRate,
          seq: nextSeq,
        },
      ]);
    }
    setOfferError(null);
    setNextSeq((s) => s + 1);
  }

  function executeRequest() {
    if (!preview.ok) return;
    if (preview.direction === "buyEur") {
      setEurBook(preview.value.book);
      setLastExecution({ direction: "buyEur", value: preview.value });
    } else {
      setXofBook(preview.value.book);
      setLastExecution({ direction: "buyXof", value: preview.value });
    }
  }

  function resetBooks() {
    setEurBook(INITIAL_EUR_BOOK);
    setXofBook(INITIAL_XOF_BOOK);
    setNextSeq(INITIAL_NEXT_SEQ);
    setLastExecution(null);
  }

  const canExecute = preview.ok && preview.value.fills.length > 0;

  return (
    <section>
      {/* Sens de l'échange */}
      <fieldset style={{ border: "1px solid #ccc", borderRadius: 4, padding: "0.5rem 1rem", marginBottom: "1rem" }}>
        <legend>Sens de l&apos;échange</legend>
        <label style={{ marginRight: "1.5rem" }}>
          <input type="radio" name="direction" checked={direction === "buyEur"}
            onChange={() => changeDirection("buyEur")} />{" "}
          J&apos;ai des XOF, je veux des EUR
        </label>
        <label>
          <input type="radio" name="direction" checked={direction === "buyXof"}
            onChange={() => changeDirection("buyXof")} />{" "}
          J&apos;ai des EUR, je veux des XOF
        </label>
      </fieldset>

      {/* Demande */}
      <h2 style={{ fontSize: "1.1rem" }}>
        1. {direction === "buyEur" ? "Demande d'achat d'EUR" : "Demande d'achat de XOF"}
      </h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {direction === "buyEur" ? (
          <>
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
          </>
        ) : (
          <>
            <label style={labelStyle}>
              Montant à dépenser (EUR)
              <input type="number" value={eur} min={0.01} step={10}
                onChange={(e) => setEur(Number(e.target.value))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Taux minimum (XOF / EUR)
              <input type="number" value={minRate} min={1} step={0.5}
                onChange={(e) => setMinRate(Number(e.target.value))} style={inputStyle} />
            </label>
          </>
        )}
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
            <FillsTable fills={preview.value.fills} direction={preview.direction} />
          )}
          {preview.direction === "buyEur" ? (
            <BuyEurSummary result={preview.value} />
          ) : (
            <BuyXofSummary result={preview.value} />
          )}
          <button type="button" onClick={executeRequest} disabled={!canExecute}
            style={{ ...buttonStyle, opacity: canExecute ? 1 : 0.4 }}>
            Exécuter cette demande
          </button>
        </>
      )}

      {/* Nouvelle offre */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>
        2. {direction === "buyEur" ? "Proposer des EUR à la vente" : "Proposer des XOF à la vente"}
      </h2>
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {direction === "buyEur" ? (
          <>
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
          </>
        ) : (
          <>
            <label style={labelStyle}>
              Montant de XOF à vendre
              <input type="number" value={offerXof} min={1} step={1000}
                onChange={(e) => setOfferXof(Number(e.target.value))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Taux maximum accepté (XOF / EUR)
              <input type="number" value={offerMaxRate} min={1} step={0.5}
                onChange={(e) => setOfferMaxRate(Number(e.target.value))} style={inputStyle} />
            </label>
          </>
        )}
        <button type="button" onClick={addOffer} style={buttonStyle}>Ajouter l&apos;offre</button>
      </div>
      {offerError && <p style={{ color: "#b00020" }}>{offerError}</p>}

      {/* Carnet */}
      <h2 style={{ fontSize: "1.1rem", marginTop: "2rem" }}>
        Carnet d&apos;ordres : {direction === "buyEur" ? "vendeurs d'EUR" : "vendeurs de XOF"}
      </h2>
      {direction === "buyEur" ? (
        eurBook.length === 0 ? (
          <p>Le carnet est vide.</p>
        ) : (
          <ul>
            {eurBook.map((o) => (
              <li key={o.id}>
                {o.ownerId} : {fmtEur(o.eurCentsRemaining)} disponibles à partir de {o.minRateXofPerEur} XOF / EUR
              </li>
            ))}
          </ul>
        )
      ) : xofBook.length === 0 ? (
        <p>Le carnet est vide.</p>
      ) : (
        <ul>
          {xofBook.map((o) => (
            <li key={o.id}>
              {o.ownerId} : {fmtXof(o.xofRemaining)} disponibles jusqu&apos;à {o.maxRateXofPerEur} XOF / EUR
              {isXofDust(o) && (
                <span style={warningStyle}>
                  {" "}(reste technique : vaut moins d&apos;un centime à ce taux, n&apos;est plus appariable)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={resetBooks} style={{ ...buttonStyle, background: "#777" }}>
        Réinitialiser les données de démonstration
      </button>

      {/* Dernière exécution */}
      {lastExecution && (
        <div style={{ marginTop: "2rem", padding: 12, background: "#eef7ee", borderRadius: 4 }}>
          <strong>Dernière exécution (simulation) :</strong>{" "}
          {lastExecution.direction === "buyEur"
            ? `${fmtXof(lastExecution.value.xofFilled)} dépensés contre des EUR`
            : `${fmtEur(lastExecution.value.eurCentsFilled)} dépensés contre ${fmtXof(lastExecution.value.xofReceived)}`}{" "}
          à travers {lastExecution.value.fills.length} vendeur(s). Aucun paiement réel n&apos;a été effectué.
        </div>
      )}
    </section>
  );
}

function BuyEurSummary({ result }: { result: MatchResult }) {
  const eurReceived = result.fills.reduce((sum, f) => sum + f.eurCents, 0);
  return (
    <>
      <p>
        <strong>Servi :</strong> {fmtXof(result.xofFilled)} contre {fmtEur(eurReceived)} &nbsp;·&nbsp;
        <strong>Non servi :</strong> {fmtXof(result.xofUnfilled)}
      </p>
      {result.xofRoundingRemainder > 0 && (
        <p style={warningStyle}>
          Dont {fmtXof(result.xofRoundingRemainder)} de reste technique : trop peu pour acheter
          1 centime d&apos;euro. Ce montant n&apos;est pas dépensé et reste au demandeur.
        </p>
      )}
    </>
  );
}

function BuyXofSummary({ result }: { result: XofMatchResult }) {
  // Restes techniques que cette exécution laisserait chez les vendeurs servis.
  const servedIds = new Set(result.fills.map((f) => f.offerId));
  const dustLeft = result.book
    .filter((o) => servedIds.has(o.id) && isXofDust(o))
    .reduce((sum, o) => sum + o.xofRemaining, 0);
  return (
    <>
      <p>
        <strong>Servi :</strong> {fmtEur(result.eurCentsFilled)} contre {fmtXof(result.xofReceived)} &nbsp;·&nbsp;
        <strong>Non servi :</strong> {fmtEur(result.eurCentsUnfilled)}
      </p>
      {dustLeft > 0 && (
        <p style={warningStyle}>
          Reste technique : {fmtXof(dustLeft)} resteraient chez les vendeurs servis, car ce montant
          vaut moins d&apos;un centime d&apos;euro à leur taux.
        </p>
      )}
    </>
  );
}

function FillsTable({ fills, direction }: { fills: Fill[]; direction: Direction }) {
  const buyEur = direction === "buyEur";
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "1rem" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
          <th>Vendeur</th>
          <th>{buyEur ? "EUR reçus" : "EUR payés"}</th>
          <th>{buyEur ? "XOF payés" : "XOF reçus"}</th>
          <th>Taux</th>
        </tr>
      </thead>
      <tbody>
        {fills.map((f) => (
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
