import type { Queryable } from "./db";

export interface Profile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
}

/** Profil d'un utilisateur (champs vides pour un compte créé sans inscription complète). */
export async function getProfile(sql: Queryable, userId: string): Promise<Profile> {
  const [row] = await sql<
    { first_name: string | null; last_name: string | null; phone: string | null; suspended_at: Date | null; suspended_reason: string | null }[]
  >`
    select first_name, last_name, phone, suspended_at, suspended_reason from public.profiles where user_id = ${userId}
  `;
  return {
    firstName: row?.first_name ?? null,
    lastName: row?.last_name ?? null,
    phone: row?.phone ?? null,
    suspendedAt: row?.suspended_at ?? null,
    suspendedReason: row?.suspended_reason ?? null,
  };
}
