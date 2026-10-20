"use server";

import { redirect } from "next/navigation";
import { isBackendConfigured, siteUrl } from "@/server/config";
import { getSql } from "@/server/db";
import { canSignIn } from "@/server/invites";
import { createSupabaseServerClient } from "@/server/supabase";

export type LoginState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string; info?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Connexion sans mot de passe en deux temps : envoi d'un e-mail (code + lien), puis
 * vérification du code. Les messages ne révèlent jamais si une adresse est déjà inscrite.
 */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = String(formData.get("intent") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!isBackendConfigured()) {
    return { step: "email", email, error: "Le pilote n'est pas encore ouvert. Revenez bientôt." };
  }
  if (intent === "change") return { step: "email", email };
  if (!EMAIL.test(email) || email.length > 254) {
    return { step: "email", email, error: "Adresse e-mail invalide." };
  }

  const supabase = await createSupabaseServerClient();

  if (intent === "send" || intent === "resend") {
    if (!(await canSignIn(getSql(), email))) {
      return {
        step: "email",
        email,
        error: "Le pilote est sur invitation : cette adresse n'a pas encore été invitée.",
      };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${siteUrl()}/auth/confirm` },
    });
    if (error) {
      const tooMany = error.status === 429;
      if (!tooMany) console.error("Envoi du code impossible", error.message);
      return {
        step: intent === "resend" ? "code" : "email",
        email,
        error: tooMany
          ? "Trop de demandes. Patientez quelques minutes avant de redemander un code."
          : "L'e-mail n'a pas pu être envoyé. Réessayez dans un instant.",
      };
    }
    return { step: "code", email, info: intent === "resend" ? "Un nouveau code vient d'être envoyé." : undefined };
  }

  if (intent === "verify") {
    const token = String(formData.get("token") ?? "").replace(/\s/g, "");
    if (!/^\d{6}$/.test(token)) return { step: "code", email, error: "Le code contient 6 chiffres." };
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { step: "code", email, error: "Code incorrect ou expiré." };
    redirect("/app");
  }

  return { step: "email", email };
}

export async function signOutAction(): Promise<void> {
  if (isBackendConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
