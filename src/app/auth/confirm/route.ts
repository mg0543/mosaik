import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isBackendConfigured } from "@/server/config";
import { createSupabaseServerClient } from "@/server/supabase";

const ALLOWED_TYPES: readonly EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * Lien de connexion reçu par e-mail (format token_hash : il fonctionne même ouvert sur un
 * autre appareil que celui qui a demandé le code).
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (isBackendConfigured() && tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect("/app");
  }
  redirect("/connexion?erreur=lien");
}
