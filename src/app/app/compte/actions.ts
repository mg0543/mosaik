"use server";

import { revalidatePath } from "next/cache";
import { isXofOperator } from "@/lib/payment";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { saveEurDetails, saveXofDetails } from "@/server/settlements";

export interface DetailsState {
  error?: string;
  saved?: boolean;
}

async function save(run: () => Promise<void>): Promise<DetailsState> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RangeError) return { error: error.message };
    console.error("Enregistrement des coordonnées impossible", error);
    return { error: "L'enregistrement a échoué. Réessayez dans un instant." };
  }
  revalidatePath("/app", "layout");
  return { saved: true };
}

export async function saveEurDetailsAction(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const user = await requireUser();
  return save(() =>
    saveEurDetails(getSql(), user.id, {
      iban: String(formData.get("iban") ?? ""),
      holder: String(formData.get("holder") ?? ""),
    }),
  );
}

export async function saveXofDetailsAction(_prev: DetailsState, formData: FormData): Promise<DetailsState> {
  const user = await requireUser();
  const operator = formData.get("operator");
  if (!isXofOperator(operator)) return { error: "Choisissez un opérateur." };
  return save(() =>
    saveXofDetails(getSql(), user.id, {
      operator,
      phone: String(formData.get("phone") ?? ""),
      holder: String(formData.get("holder") ?? ""),
    }),
  );
}
