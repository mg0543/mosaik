"use server";

import { revalidatePath } from "next/cache";
import { addInvite, adminCancelOrder, reactivateUser, removeInvite, resolveDispute, suspendUser } from "@/server/admin";
import { requireAdmin } from "@/server/auth";
import { getSql } from "@/server/db";

export interface AdminActionState {
  error?: string;
  done?: string;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/** Exécute une action d'administration : rôle revérifié, erreurs métier rendues lisibles. */
async function run(path: string, done: string, action: (adminId: string) => Promise<void>): Promise<AdminActionState> {
  const admin = await requireAdmin();
  try {
    await action(admin.id);
  } catch (error) {
    if (error instanceof RangeError) return { error: error.message };
    console.error("Action d'administration impossible", error);
    return { error: "L'action a échoué. Réessayez dans un instant." };
  }
  revalidatePath(path);
  revalidatePath("/admin");
  return { done };
}

export async function suspendUserAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return run("/admin/utilisateurs", "Compte suspendu.", (adminId) =>
    suspendUser(getSql(), adminId, text(formData, "userId"), text(formData, "reason")),
  );
}

export async function reactivateUserAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return run("/admin/utilisateurs", "Compte réactivé.", (adminId) => reactivateUser(getSql(), adminId, text(formData, "userId")));
}

export async function cancelOrderAdminAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return run("/admin/echanges", "Demande annulée.", (adminId) =>
    adminCancelOrder(getSql(), adminId, text(formData, "orderId"), text(formData, "reason")),
  );
}

export async function resolveDisputeAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const resolution = formData.get("resolution");
  if (resolution !== "completed" && resolution !== "failed") return { error: "Choisissez une décision." };
  return run("/admin/litiges", "Litige tranché.", (adminId) =>
    resolveDispute(getSql(), adminId, text(formData, "tradeId"), resolution, text(formData, "note")),
  );
}

export async function addInviteAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return run("/admin/invitations", "Invitation ajoutée.", (adminId) =>
    addInvite(getSql(), adminId, text(formData, "email"), text(formData, "note")),
  );
}

export async function removeInviteAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return run("/admin/invitations", "Invitation retirée.", (adminId) => removeInvite(getSql(), adminId, text(formData, "email")));
}
