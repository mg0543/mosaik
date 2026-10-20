import { redirect } from "next/navigation";
import { cache } from "react";
import { isBackendConfigured } from "./config";
import { createSupabaseServerClient } from "./supabase";

export interface CurrentUser {
  id: string;
  email: string;
}

/**
 * Utilisateur connecté, vérifié auprès du serveur d'authentification (pas seulement lu dans
 * le cookie). Mis en cache pour la durée d'une requête.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!isBackendConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
});

/** À appeler en tête de chaque page ou action réservée : redirige vers la connexion sinon. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}
