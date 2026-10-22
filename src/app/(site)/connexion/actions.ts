"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { checkPassword, parseEmail, parseName, parseOptionalPhone } from "@/lib/account";
import { isBackendConfigured, isInviteOnly, siteUrl } from "@/server/config";
import { getSql } from "@/server/db";
import { recordEvent } from "@/server/audit";
import { canSignIn } from "@/server/invites";
import { createSupabaseServerClient } from "@/server/supabase";

const NOT_OPEN = "Le pilote n'est pas encore ouvert. Revenez bientôt.";
const TOO_MANY = "Trop de tentatives. Patientez quelques minutes avant de réessayer.";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function isRateLimited(error: AuthError): boolean {
  return error.status === 429 || (error.code ?? "").startsWith("over_");
}

// ---------------------------------------------------------------------------
// Inscription
// ---------------------------------------------------------------------------

export interface SignUpFields {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface SignUpState {
  error?: string;
  fields?: SignUpFields;
  /** Adresse à laquelle un e-mail de confirmation a été envoyé. */
  confirmEmail?: string;
}

/**
 * Crée un compte : prénom, nom, e-mail, téléphone facultatif et mot de passe choisi.
 * Tout est revérifié ici ; le profil est créé par la base dans la même transaction.
 */
export async function signUpAction(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const fields: SignUpFields = {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
  };
  if (!isBackendConfigured()) return { error: NOT_OPEN, fields };

  let firstName: string, lastName: string, email: string, phone: string | null;
  try {
    firstName = parseName(fields.firstName, "Prénom");
    lastName = parseName(fields.lastName, "Nom");
    email = parseEmail(fields.email);
    phone = parseOptionalPhone(fields.phone);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Saisie invalide.", fields };
  }

  const password = text(formData, "password");
  const passwordProblem = checkPassword(password);
  if (passwordProblem) return { error: passwordProblem, fields };
  if (password !== text(formData, "passwordConfirm")) return { error: "Les deux mots de passe ne sont pas identiques.", fields };
  if (formData.get("terms") !== "on") {
    return { error: "Vous devez accepter les conditions du pilote et la politique de confidentialité.", fields };
  }

  if (isInviteOnly() && !(await canSignIn(getSql(), email))) {
    return { error: "Le pilote est sur invitation : cette adresse n'a pas encore été invitée.", fields };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, phone },
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
    },
  });

  if (error) {
    if (isRateLimited(error)) return { error: TOO_MANY, fields };
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { error: "Un compte existe déjà avec cette adresse : connectez-vous.", fields };
    }
    if (error.code === "weak_password") return { error: "Ce mot de passe est trop faible : choisissez-en un autre.", fields };
    console.error("Inscription impossible", error.code, error.message);
    return { error: "L'inscription a échoué. Réessayez dans un instant.", fields };
  }

  if (data.user) {
    await recordEvent(getSql(), { actorId: data.user.id, actorRole: "user", action: "user.signed_up", entity: "user", entityId: data.user.id });
  }
  // Confirmation d'adresse désactivée : le compte est ouvert tout de suite.
  if (data.session) redirect("/app");
  // Sinon, un e-mail de confirmation est parti (message identique si l'adresse existait déjà).
  return { confirmEmail: email };
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export interface SignInState {
  error?: string;
  email?: string;
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = text(formData, "email").trim().toLowerCase();
  const password = text(formData, "password");
  if (!isBackendConfigured()) return { error: NOT_OPEN, email };
  if (!email || !password) return { error: "Saisissez votre adresse e-mail et votre mot de passe.", email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Trace de sécurité : les tentatives échouées alimentent le centre d'audit.
    await recordEvent(getSql(), {
      actorId: null, actorRole: "system", action: "user.sign_in_failed", entity: "user", entityId: null,
      details: { email, reason: error.code ?? "inconnue" },
    }).catch((e) => console.error("Trace de connexion impossible", e));
    if (isRateLimited(error)) return { error: TOO_MANY, email };
    if (error.code === "email_not_confirmed") {
      return { error: "Confirmez d'abord votre adresse avec le lien reçu par e-mail.", email };
    }
    // Même message que l'adresse existe ou non : on ne révèle pas qui est inscrit.
    return { error: "Adresse e-mail ou mot de passe incorrect.", email };
  }
  await recordEvent(getSql(), { actorId: data.user.id, actorRole: "user", action: "user.signed_in", entity: "user", entityId: data.user.id });
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Mot de passe oublié : code par e-mail, puis nouveau mot de passe
// ---------------------------------------------------------------------------

export type ResetState =
  | { step: "email"; email?: string; error?: string }
  | { step: "code"; email: string; error?: string; info?: string };

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const intent = text(formData, "intent");
  const email = text(formData, "email").trim().toLowerCase();
  if (!isBackendConfigured()) return { step: "email", email, error: NOT_OPEN };
  if (intent === "change") return { step: "email", email };

  let validEmail: string;
  try {
    validEmail = parseEmail(email);
  } catch {
    return { step: "email", email, error: "Adresse e-mail invalide." };
  }
  const supabase = await createSupabaseServerClient();

  if (intent === "send" || intent === "resend") {
    // shouldCreateUser: false : aucune création de compte par ce chemin.
    const { error } = await supabase.auth.signInWithOtp({ email: validEmail, options: { shouldCreateUser: false } });
    if (error && isRateLimited(error)) return { step: intent === "resend" ? "code" : "email", email, error: TOO_MANY };
    if (error && error.status !== 422 && error.status !== 400) console.error("Envoi du code impossible", error.code, error.message);
    // Réponse identique que l'adresse ait un compte ou non.
    return {
      step: "code",
      email: validEmail,
      info: intent === "resend" ? "Si un compte existe, un nouveau code vient d'être envoyé." : undefined,
    };
  }

  if (intent === "verify") {
    const token = text(formData, "token").replace(/\s/g, "");
    const password = text(formData, "password");
    if (!/^\d{6}$/.test(token)) return { step: "code", email: validEmail, error: "Le code contient 6 chiffres." };
    const passwordProblem = checkPassword(password);
    if (passwordProblem) return { step: "code", email: validEmail, error: passwordProblem };
    if (password !== text(formData, "passwordConfirm")) {
      return { step: "code", email: validEmail, error: "Les deux mots de passe ne sont pas identiques." };
    }
    const { error } = await supabase.auth.verifyOtp({ email: validEmail, token, type: "email" });
    if (error) return { step: "code", email: validEmail, error: "Code incorrect ou expiré." };
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.error("Changement de mot de passe impossible", updateError.code, updateError.message);
      return { step: "code", email: validEmail, error: "Le mot de passe n'a pas pu être changé. Réessayez." };
    }
    redirect("/app");
  }

  return { step: "email", email };
}

export async function signOutAction(): Promise<void> {
  if (isBackendConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    await supabase.auth.signOut();
    if (data.user) {
      await recordEvent(getSql(), { actorId: data.user.id, actorRole: "user", action: "user.signed_out", entity: "user", entityId: data.user.id });
    }
  }
  redirect("/");
}
