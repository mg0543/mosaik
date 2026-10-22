"use server";

import { redirect } from "next/navigation";
import { parseEurCents, parseRate, parseXof, type Side } from "@/lib/matching";
import { checkOrderPolicy } from "@/lib/policy";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { placeOrderForUser } from "@/server/orders";

export interface ExchangeState {
  error?: string;
}

/**
 * Enregistre l'ordre de l'utilisateur connecté. L'identité vient de la session, jamais du
 * formulaire ; montants et taux sont relus et revérifiés ici, quoi qu'ait affiché l'aperçu.
 */
export async function placeOrderAction(_prev: ExchangeState, formData: FormData): Promise<ExchangeState> {
  const user = await requireUser();

  const side = formData.get("side");
  if (side !== "SELL_EUR" && side !== "SELL_XOF") return { error: "Sens de l'échange invalide." };

  let amount: number;
  let limitRate: number;
  try {
    amount = side === "SELL_XOF" ? parseXof(String(formData.get("amount") ?? "")) : parseEurCents(String(formData.get("amount") ?? ""));
    limitRate = parseRate(String(formData.get("rate") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Saisie invalide." };
  }

  const refusal = checkOrderPolicy(side as Side, amount, limitRate);
  if (refusal) return { error: refusal };

  let orderId: string;
  try {
    ({ orderId } = await placeOrderForUser(getSql(), { userId: user.id, side, amount, limitRate }));
  } catch (error) {
    if (error instanceof RangeError) return { error: error.message };
    console.error("Enregistrement de l'échange impossible", error);
    return { error: "L'échange n'a pas pu être enregistré. Réessayez dans un instant." };
  }

  redirect(`/app/ordres/${orderId}?nouveau=1`);
}
