import type { Queryable } from "./db";

/**
 * Pilote sur invitation : une adresse peut se connecter si elle a été invitée ou si son
 * compte existe déjà. Les invitations s'ajoutent par l'administrateur (voir le README).
 */
export async function canSignIn(sql: Queryable, email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const [row] = await sql<{ allowed: boolean }[]>`
    select exists (select 1 from public.pilot_invites where email = ${normalized})
        or exists (select 1 from auth.users where lower(email) = ${normalized}) as allowed
  `;
  return row.allowed;
}

/** Invite une adresse au pilote (sans effet si elle l'est déjà). */
export async function inviteToPilot(sql: Queryable, email: string, note?: string): Promise<void> {
  await sql`
    insert into public.pilot_invites (email, note) values (${email.trim().toLowerCase()}, ${note ?? null})
    on conflict (email) do nothing
  `;
}
