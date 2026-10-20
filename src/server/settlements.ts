import { parseHolder, parseIban, parseXofPhone, type PaymentDetails, type XofOperator } from "../lib/payment";
import type { SettlementRole, SettlementStep } from "../lib/settlement";
import type { Queryable, Sql } from "./db";

/**
 * Coordonnées de réception et suivi du règlement entre participants.
 * Mosaik ne déplace aucun argent : ce module enregistre où chacun doit payer et ce que
 * chacun déclare avoir envoyé ou reçu. Toutes les écritures vérifient l'identité de
 * l'utilisateur dans la requête elle-même (clause WHERE), jamais après coup.
 */

const NO_DETAILS: PaymentDetails = { eurIban: null, eurHolder: null, xofOperator: null, xofPhone: null, xofHolder: null };

export async function getPaymentDetails(sql: Queryable, userId: string): Promise<PaymentDetails> {
  return (await getPaymentDetailsOf(sql, [userId])).get(userId) ?? NO_DETAILS;
}

/** Coordonnées de plusieurs utilisateurs en une requête ; absentes de la table = non renseignées. */
export async function getPaymentDetailsOf(sql: Queryable, userIds: readonly string[]): Promise<Map<string, PaymentDetails>> {
  if (userIds.length === 0) return new Map();
  const rows = await sql<
    { user_id: string; eur_iban: string | null; eur_holder: string | null; xof_operator: XofOperator | null; xof_phone: string | null; xof_holder: string | null }[]
  >`
    select user_id, eur_iban, eur_holder, xof_operator, xof_phone, xof_holder
    from public.payment_details where user_id in ${sql([...userIds])}
  `;
  return new Map(
    rows.map((r) => [
      r.user_id,
      { eurIban: r.eur_iban, eurHolder: r.eur_holder, xofOperator: r.xof_operator, xofPhone: r.xof_phone, xofHolder: r.xof_holder },
    ]),
  );
}

/** Enregistre les coordonnées pour recevoir des euros (IBAN validé). */
export async function saveEurDetails(sql: Sql, userId: string, input: { iban: string; holder: string }): Promise<void> {
  const iban = parseIban(input.iban);
  const holder = parseHolder(input.holder);
  await sql`
    insert into public.payment_details (user_id, eur_iban, eur_holder) values (${userId}, ${iban}, ${holder})
    on conflict (user_id) do update set eur_iban = excluded.eur_iban, eur_holder = excluded.eur_holder
  `;
}

/** Enregistre les coordonnées pour recevoir des XOF (numéro mobile money de la zone XOF). */
export async function saveXofDetails(
  sql: Sql,
  userId: string,
  input: { operator: XofOperator; phone: string; holder: string },
): Promise<void> {
  const phone = parseXofPhone(input.phone);
  const holder = parseHolder(input.holder);
  await sql`
    insert into public.payment_details (user_id, xof_operator, xof_phone, xof_holder)
    values (${userId}, ${input.operator}, ${phone}, ${holder})
    on conflict (user_id) do update
      set xof_operator = excluded.xof_operator, xof_phone = excluded.xof_phone, xof_holder = excluded.xof_holder
  `;
}

const STEP_RULES: Record<SettlementStep, { actor: SettlementRole; column: string; requires: string | null }> = {
  taker_sent: { actor: "taker", column: "taker_sent_at", requires: null },
  maker_received: { actor: "maker", column: "maker_received_at", requires: "taker_sent_at" },
  maker_sent: { actor: "maker", column: "maker_sent_at", requires: "maker_received_at" },
  taker_received: { actor: "taker", column: "taker_received_at", requires: "maker_sent_at" },
};

/**
 * Confirme une étape du règlement. Ne réussit que si l'utilisateur est bien le participant
 * attendu, que l'étape précédente est faite, que celle-ci ne l'est pas, et qu'aucun litige
 * n'est ouvert. Renvoie false sinon (rien n'est modifié).
 */
export async function confirmSettlementStep(sql: Sql, userId: string, tradeId: string, step: SettlementStep): Promise<boolean> {
  const rule = STEP_RULES[step];
  if (!rule || !isUuid(tradeId)) return false;
  const rows = await sql`
    update public.settlements set ${sql(rule.column)} = now()
    where trade_id = ${tradeId}
      and ${sql(rule.actor === "taker" ? "taker_id" : "maker_id")} = ${userId}
      and ${sql(rule.column)} is null
      ${rule.requires ? sql`and ${sql(rule.requires)} is not null` : sql``}
      and disputed_at is null
    returning trade_id
  `;
  return rows.length === 1;
}

/** Signale un litige sur un règlement non terminé ; le règlement est alors gelé. */
export async function openDispute(sql: Sql, userId: string, tradeId: string, reason: string): Promise<boolean> {
  const text = reason.replace(/\s+/g, " ").trim();
  if (text.length < 5 || text.length > 500) throw new RangeError("Décrivez le problème en 5 à 500 caractères.");
  if (!isUuid(tradeId)) return false;
  const rows = await sql`
    update public.settlements
    set disputed_at = now(), disputed_by = ${userId}, dispute_reason = ${text}
    where trade_id = ${tradeId}
      and (taker_id = ${userId} or maker_id = ${userId})
      and disputed_at is null
      and taker_received_at is null
    returning trade_id
  `;
  return rows.length === 1;
}

export interface PendingAction {
  tradeId: string;
  orderId: string;
  step: SettlementStep;
  dueAt: Date;
}

/** Règlements où c'est à l'utilisateur d'agir : sa liste « À faire ». */
export async function getPendingActions(sql: Sql, userId: string): Promise<PendingAction[]> {
  const rows = await sql<{ trade_id: string; order_id: string; step: SettlementStep; due_at: Date }[]>`
    select s.trade_id, s.due_at,
           case when s.taker_id = ${userId} then t.taker_order_id else t.maker_order_id end as order_id,
           case
             when s.taker_sent_at is null then 'taker_sent'
             when s.maker_received_at is null then 'maker_received'
             when s.maker_sent_at is null then 'maker_sent'
             else 'taker_received'
           end as step
    from public.settlements s
    join public.trades t on t.id = s.trade_id
    where s.disputed_at is null and s.taker_received_at is null
      and (
        (s.taker_id = ${userId} and (s.taker_sent_at is null or (s.maker_sent_at is not null and s.taker_received_at is null)))
        or (s.maker_id = ${userId} and s.taker_sent_at is not null and s.maker_sent_at is null)
      )
    order by s.due_at, s.trade_id
  `;
  return rows.map((r) => ({ tradeId: r.trade_id, orderId: r.order_id, step: r.step, dueAt: r.due_at }));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (value: string) => UUID.test(value);
