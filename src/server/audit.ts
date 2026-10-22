import type { Queryable } from "./db";

/**
 * Journal d'audit : chaque action importante y laisse une trace, dans la même transaction que
 * l'action elle-même. Le journal est en ajout seul (imposé par la base). On n'y écrit jamais de
 * coordonnées bancaires ni de mot de passe.
 */

export type ActorRole = "user" | "admin" | "system";

/** Détails d'un événement : valeurs simples uniquement. */
export type AuditDetails = Record<string, string | number | boolean | null>;

export interface AuditInput {
  actorId: string | null;
  actorRole: ActorRole;
  /** Forme « domaine.action », par exemple « order.placed ». */
  action: string;
  entity: string;
  entityId?: string | null;
  details?: AuditDetails;
}

export async function recordEvent(sql: Queryable, event: AuditInput): Promise<void> {
  await sql`
    insert into public.audit_events (actor_id, actor_role, action, entity, entity_id, details)
    values (${event.actorId}, ${event.actorRole}, ${event.action}, ${event.entity}, ${event.entityId ?? null},
            ${sql.json(event.details ?? {})})
  `;
}

export interface AuditEvent {
  id: number;
  at: Date;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: ActorRole;
  action: string;
  entity: string;
  entityId: string | null;
  details: AuditDetails;
}

/** Derniers événements, du plus récent au plus ancien, avec filtres facultatifs. */
export async function listAuditEvents(
  sql: Queryable,
  filters: { limit?: number; action?: string; actorId?: string; beforeId?: number } = {},
): Promise<AuditEvent[]> {
  const rows = await sql<
    { id: number; at: Date; actor_id: string | null; email: string | null; actor_role: ActorRole; action: string; entity: string; entity_id: string | null; details: AuditDetails }[]
  >`
    select a.id, a.at, a.actor_id, u.email, a.actor_role, a.action, a.entity, a.entity_id, a.details
    from public.audit_events a
    left join auth.users u on u.id = a.actor_id
    where true
      ${filters.action ? sql`and a.action like ${`${filters.action}%`}` : sql``}
      ${filters.actorId ? sql`and a.actor_id = ${filters.actorId}` : sql``}
      ${filters.beforeId ? sql`and a.id < ${filters.beforeId}` : sql``}
    order by a.id desc
    limit ${filters.limit ?? 100}
  `;
  return rows.map((r) => ({
    id: r.id, at: r.at, actorId: r.actor_id, actorEmail: r.email, actorRole: r.actor_role,
    action: r.action, entity: r.entity, entityId: r.entity_id, details: r.details,
  }));
}
