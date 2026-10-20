import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase à chaque requête et redirige les visiteurs non connectés
 * hors de l'espace /app. Ce n'est qu'une vérification rapide : chaque page et chaque action
 * revérifie l'utilisateur côté serveur (requireUser).
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  if (!data.user && request.nextUrl.pathname.startsWith("/app")) {
    const login = request.nextUrl.clone();
    login.pathname = "/connexion";
    login.search = "";
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  // Ni les fichiers statiques ni les icônes : seulement les pages et les actions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|apple-icon|icon).*)"],
};
