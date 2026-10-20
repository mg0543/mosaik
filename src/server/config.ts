/**
 * Configuration serveur. Tant que le projet Supabase n'est pas relié (variables absentes),
 * l'application affiche « pilote bientôt ouvert » au lieu d'échouer.
 */
export function isBackendConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.DATABASE_URL,
  );
}

/** URL publique du site, utilisée dans les liens envoyés par e-mail. */
export function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
