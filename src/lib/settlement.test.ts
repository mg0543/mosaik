import { describe, expect, it } from "vitest";
import {
  actionFor,
  nextStep,
  settlementStatus,
  stepButton,
  stepDoneAt,
  stepLabel,
  type SettlementState,
} from "./settlement";

const due = new Date("2026-10-21T12:00:00Z");
const before = new Date("2026-10-21T10:00:00Z");
const after = new Date("2026-10-21T13:00:00Z");
const t = new Date("2026-10-20T12:00:00Z");

const state = (done: Partial<SettlementState> = {}): SettlementState => ({
  dueAt: due,
  takerSentAt: null,
  makerReceivedAt: null,
  makerSentAt: null,
  takerReceivedAt: null,
  disputedAt: null,
  ...done,
});

describe("protocole de règlement", () => {
  it("fait agir le preneur en premier, puis alterne jusqu'au règlement", () => {
    const steps: [Partial<SettlementState>, string | null, "taker" | "maker" | null][] = [
      [{}, "taker_sent", "taker"],
      [{ takerSentAt: t }, "maker_received", "maker"],
      [{ takerSentAt: t, makerReceivedAt: t }, "maker_sent", "maker"],
      [{ takerSentAt: t, makerReceivedAt: t, makerSentAt: t }, "taker_received", "taker"],
      [{ takerSentAt: t, makerReceivedAt: t, makerSentAt: t, takerReceivedAt: t }, null, null],
    ];
    for (const [done, step, actor] of steps) {
      const s = state(done);
      expect(nextStep(s)).toBe(step);
      expect(actionFor(s, "taker")).toBe(actor === "taker" ? step : null);
      expect(actionFor(s, "maker")).toBe(actor === "maker" ? step : null);
    }
  });

  it("gèle toute action en cas de litige", () => {
    const s = state({ takerSentAt: t, disputedAt: t });
    expect(actionFor(s, "maker")).toBeNull();
    expect(actionFor(s, "taker")).toBeNull();
    expect(settlementStatus(s, "maker", before)).toEqual({ label: "Litige signalé", tone: "dispute" });
  });

  it("indique à chacun s'il doit agir, attendre, s'il est en retard ou si c'est réglé", () => {
    expect(settlementStatus(state(), "taker", before).tone).toBe("todo");
    expect(settlementStatus(state(), "maker", before).tone).toBe("wait");
    expect(settlementStatus(state(), "maker", after)).toEqual({ label: "En retard", tone: "late" });
    const settled = state({ takerSentAt: t, makerReceivedAt: t, makerSentAt: t, takerReceivedAt: t });
    expect(settlementStatus(settled, "taker", after)).toEqual({ label: "Réglé", tone: "done" });
  });

  it("libelle les étapes selon celui qui regarde", () => {
    expect(stepLabel("taker_sent", "taker")).toBe("Vous envoyez votre part");
    expect(stepLabel("taker_sent", "maker")).toBe("La contrepartie envoie sa part");
    expect(stepLabel("maker_received", "maker")).toBe("Vous confirmez la réception");
    expect(stepButton("maker_sent")).toBe("J'ai envoyé l'argent");
    expect(stepButton("taker_received")).toBe("J'ai bien reçu l'argent");
    expect(stepDoneAt(state({ makerSentAt: t }), "maker_sent")).toBe(t);
  });
});
