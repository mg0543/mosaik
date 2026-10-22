import type { Queryable } from "./db";

export interface Profile {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}

/** Profil d'un utilisateur (champs vides pour un compte créé sans inscription complète). */
export async function getProfile(sql: Queryable, userId: string): Promise<Profile> {
  const [row] = await sql<{ first_name: string | null; last_name: string | null; phone: string | null }[]>`
    select first_name, last_name, phone from public.profiles where user_id = ${userId}
  `;
  return { firstName: row?.first_name ?? null, lastName: row?.last_name ?? null, phone: row?.phone ?? null };
}
