/**
 * Protocole de règlement entre participants (MEYA ne touche jamais l'argent).
 * Ordre imposé, pour qu'un seul participant soit exposé à la fois :
 *   1. le preneur envoie sa part          (taker_sent)
 *   2. le faiseur confirme la réception   (maker_received)
 *   3. le faiseur envoie sa part          (maker_sent)
 *   4. le preneur confirme la réception   (taker_received) : réglé.
 * Le preneur est l'ordre arrivé en dernier ; le faiseur, l'ordre qui attendait dans le carnet.
 */

export type SettlementRole = "taker" | "maker";
export type SettlementStep = "taker_sent" | "maker_received" | "maker_sent" | "taker_received";

export const STEPS: readonly SettlementStep[] = ["taker_sent", "maker_received", "maker_sent", "taker_received"];

/** Qui accomplit chaque étape. */
export const STEP_ACTOR: Record<SettlementStep, SettlementRole> = {
  taker_sent: "taker",
  maker_received: "maker",
  maker_sent: "maker",
  taker_received: "taker",
};

export interface SettlementState {
  dueAt: Date;
  takerSentAt: Date | null;
  makerReceivedAt: Date | null;
  makerSentAt: Date | null;
  takerReceivedAt: Date | null;
  disputedAt: Date | null;
}

const DONE: Record<SettlementStep, keyof SettlementState> = {
  taker_sent: "takerSentAt",
  maker_received: "makerReceivedAt",
  maker_sent: "makerSentAt",
  taker_received: "takerReceivedAt",
};

/** Date à laquelle une étape a été confirmée, ou null. */
export function stepDoneAt(state: SettlementState, step: SettlementStep): Date | null {
  return state[DONE[step]] as Date | null;
}

/** Prochaine étape à accomplir, ou null si le règlement est terminé. */
export function nextStep(state: SettlementState): SettlementStep | null {
  return STEPS.find((step) => stepDoneAt(state, step) === null) ?? null;
}

/** Étape que ce participant doit accomplir maintenant, ou null (attente, litige ou terminé). */
export function actionFor(state: SettlementState, role: SettlementRole): SettlementStep | null {
  if (state.disputedAt) return null;
  const step = nextStep(state);
  return step && STEP_ACTOR[step] === role ? step : null;
}

export type SettlementTone = "done" | "wait" | "todo" | "late" | "dispute";

/** Statut du règlement vu par un participant. */
export function settlementStatus(
  state: SettlementState,
  role: SettlementRole,
  now: Date,
): { label: string; tone: SettlementTone } {
  if (state.disputedAt) return { label: "Litige signalé", tone: "dispute" };
  const step = nextStep(state);
  if (!step) return { label: "Réglé", tone: "done" };
  if (now > state.dueAt) return { label: "En retard", tone: "late" };
  return STEP_ACTOR[step] === role ? { label: "À vous d'agir", tone: "todo" } : { label: "En attente de votre partenaire", tone: "wait" };
}

/** Libellé d'une étape, du point de vue de celui qui regarde. */
export function stepLabel(step: SettlementStep, role: SettlementRole): string {
  const mine = STEP_ACTOR[step] === role;
  switch (step) {
    case "taker_sent":
    case "maker_sent":
      return mine ? "Vous envoyez votre part" : "Votre partenaire envoie sa part";
    case "maker_received":
    case "taker_received":
      return mine ? "Vous confirmez la réception" : "Votre partenaire confirme la réception";
  }
}

/** Libellé du bouton qui confirme une étape. */
export function stepButton(step: SettlementStep): string {
  return step === "taker_sent" || step === "maker_sent" ? "J'ai envoyé l'argent" : "J'ai bien reçu l'argent";
}
