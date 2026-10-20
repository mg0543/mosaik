import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase côté serveur (pages, actions, routes), lié aux cookies de la requête.
 * Il sert uniquement à l'authentification : les données passent par src/server/db.ts.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Appelé depuis un composant serveur : les cookies y sont en lecture seule.
          // Le proxy rafraîchit la session à chaque requête, on peut donc ignorer l'erreur.
        }
      },
    },
  });
}
