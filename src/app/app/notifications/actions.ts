"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { getSql } from "@/server/db";
import { markAllRead } from "@/server/notifications";

/** Marque les notifications de l'utilisateur comme lues et rafraîchit le compteur de la cloche. */
export async function markAllReadAction(): Promise<void> {
  const user = await requireUser();
  if ((await markAllRead(getSql(), user.id)) > 0) revalidatePath("/app", "layout");
}
