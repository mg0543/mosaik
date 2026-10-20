"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { cancelOrderForUser } from "@/server/orders";

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
  if (!cancelled) return { error: "Cet ordre ne peut plus être annulé : il a peut-être été servi entre-temps." };
  revalidatePath(`/app/ordres/${orderId}`);
  revalidatePath("/app/ordres");
  return {};
}
