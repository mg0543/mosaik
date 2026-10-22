"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { cancelOrderForUser } from "@/server/orders";
import { confirmSettlementStep, openDispute } from "@/server/settlements";

export interface CancelState {
  error?: string;
}

/** Annule un ordre de l'utilisateur connecté ; l'identifiant est revérifié côté base. */
export async function cancelOrderAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const user = await requireUser();
  const orderId = String(formData.get("orderId") ?? "");
  let cancelled: boolean;
  try {
    cancelled = await cancelOrderForUser(getSql(), user.id, orderId);
  } catch (error) {
    console.error("Annulation impossible", error);
    return { error: "L'annulation a échoué. Réessayez dans un instant." };
  }
  if (!cancelled) return { error: "Cette demande ne peut plus être annulée : elle a peut-être été servie entre-temps." };
  revalidatePath(`/app/ordres/${orderId}`);
  revalidatePath("/app/activite");
  return {};
}

export interface SettlementActionState {
  error?: string;
}

const STEPS = ["taker_sent", "maker_received", "maker_sent", "taker_received"] as const;

/** Confirme une étape du règlement ; la base vérifie que c'est bien à cet utilisateur d'agir. */
export async function confirmStepAction(_prev: SettlementActionState, formData: FormData): Promise<SettlementActionState> {
  const user = await requireUser();
  const tradeId = String(formData.get("tradeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  const step = STEPS.find((s) => s === formData.get("step"));
  if (!step) return { error: "Étape inconnue." };
  let done: boolean;
  try {
    done = await confirmSettlementStep(getSql(), user.id, tradeId, step);
  } catch (error) {
    console.error("Confirmation impossible", error);
    return { error: "La confirmation a échoué. Réessayez dans un instant." };
  }
  if (!done) return { error: "Cette étape ne peut pas être confirmée maintenant. Rechargez la page." };
  revalidatePath(`/app/ordres/${orderId}`);
  revalidatePath("/app");
  return {};
}

/** Signale un problème : le règlement est gelé et sera examiné. */
export async function disputeAction(_prev: SettlementActionState, formData: FormData): Promise<SettlementActionState> {
  const user = await requireUser();
  const tradeId = String(formData.get("tradeId") ?? "");
  const orderId = String(formData.get("orderId") ?? "");
  let opened: boolean;
  try {
    opened = await openDispute(getSql(), user.id, tradeId, String(formData.get("reason") ?? ""));
  } catch (error) {
    if (error instanceof RangeError) return { error: error.message };
    console.error("Signalement impossible", error);
    return { error: "Le signalement a échoué. Réessayez dans un instant." };
  }
  if (!opened) return { error: "Ce règlement ne peut plus faire l'objet d'un signalement." };
  revalidatePath(`/app/ordres/${orderId}`);
  revalidatePath("/app");
  return {};
}
