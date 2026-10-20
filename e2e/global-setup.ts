import postgres from "postgres";

const LOCAL_DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Vide le carnet avant la suite. Refuse catégoriquement toute base qui n'est pas locale :
 * ce nettoyage ne doit jamais pouvoir toucher une base de production.
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL ?? LOCAL_DB;
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Tests de bout en bout refusés : la base ${host} n'est pas locale.`);
  }
  const sql = postgres(url, { max: 1 });
  try {
    await sql`truncate public.settlements, public.trades, public.orders`;
    await sql`delete from public.payment_details where user_id in (select id from auth.users where email like 'e2e-%@exemple.test')`;
    await sql`delete from public.pilot_invites where email like 'e2e-%@exemple.test'`;
    await sql`delete from auth.users where email like 'e2e-%@exemple.test'`;
  } finally {
    await sql.end();
  }
  await fetch("http://127.0.0.1:54324/api/v1/messages", { method: "DELETE" });
}
