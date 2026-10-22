import type { Queryable } from "./db";

/** Le rôle est lu dans public.app_roles, table invisible et non modifiable par les clients. */
export async function isSuperAdmin(sql: Queryable, userId: string): Promise<boolean> {
  const [row] = await sql<{ ok: boolean }[]>`
    select exists (select 1 from public.app_roles where user_id = ${userId} and role = 'super_admin') as ok
  `;
  return row.ok;
}
