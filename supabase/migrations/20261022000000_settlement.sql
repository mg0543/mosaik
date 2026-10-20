-- Règlement entre participants (pilote, option A) et accès sur invitation.
--
-- Mosaik ne reçoit, ne détient ni ne transfère aucun fonds : les participants se paient
-- directement. La plateforme fournit à chacun les coordonnées de sa contrepartie et suit
-- les confirmations, dans un ordre imposé :
--   1. le preneur (l'ordre arrivé en dernier) envoie sa part ;
--   2. le faiseur (l'ordre qui attendait) confirme la réception ;
--   3. le faiseur envoie sa part ;
--   4. le preneur confirme la réception : l'échange est réglé.
-- Ainsi, à tout moment, un seul participant est exposé. Chacun peut signaler un litige,
-- ce qui gèle le règlement.

-- ---------------------------------------------------------------------------
-- Coordonnées de réception
-- ---------------------------------------------------------------------------

create type public.xof_operator as enum ('orange_money', 'wave', 'mtn_momo', 'moov_money', 'free_money');

create table public.payment_details (
  user_id uuid primary key references auth.users (id) on delete restrict,
  -- Pour recevoir des euros : IBAN normalisé (sans espaces, majuscules) et titulaire.
  eur_iban text check (eur_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  eur_holder text check (char_length(eur_holder) between 2 and 70),
  -- Pour recevoir des XOF : opérateur mobile money, numéro international d'un pays de la zone XOF.
  xof_operator public.xof_operator,
  xof_phone text check (xof_phone ~ '^\+(221|223|225|226|227|228|229|245)[0-9]{7,10}$'),
  xof_holder text check (char_length(xof_holder) between 2 and 70),
  updated_at timestamptz not null default now(),
  constraint payment_eur_complete check ((eur_iban is null) = (eur_holder is null)),
  constraint payment_xof_complete check (
    (xof_phone is null) = (xof_operator is null) and (xof_phone is null) = (xof_holder is null)
  )
);

create trigger payment_details_touch_updated_at
before update on public.payment_details
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Règlement de chaque échange
-- ---------------------------------------------------------------------------

create table public.settlements (
  trade_id uuid primary key references public.trades (id) on delete restrict,
  taker_id uuid not null references auth.users (id) on delete restrict,
  maker_id uuid not null references auth.users (id) on delete restrict,
  -- Ce que le preneur envoie (en premier) et où : coordonnées du faiseur, figées à l'échange.
  taker_currency text not null check (taker_currency in ('EUR', 'XOF')),
  taker_amount bigint not null check (taker_amount > 0),
  taker_pays_to jsonb not null check (jsonb_typeof(taker_pays_to) = 'object'),
  -- Ce que le faiseur envoie ensuite et où : coordonnées du preneur, figées à l'échange.
  maker_amount bigint not null check (maker_amount > 0),
  maker_pays_to jsonb not null check (jsonb_typeof(maker_pays_to) = 'object'),
  -- Délai de règlement : 24 heures après l'échange.
  due_at timestamptz not null default (now() + interval '24 hours'),
  taker_sent_at timestamptz,
  maker_received_at timestamptz,
  maker_sent_at timestamptz,
  taker_received_at timestamptz,
  disputed_at timestamptz,
  disputed_by uuid references auth.users (id) on delete restrict,
  dispute_reason text check (char_length(dispute_reason) between 5 and 500),
  created_at timestamptz not null default now(),
  constraint settlements_parties check (taker_id <> maker_id),
  -- Chaque étape suppose la précédente.
  constraint settlements_sequence check (
    (maker_received_at is null or taker_sent_at is not null)
    and (maker_sent_at is null or maker_received_at is not null)
    and (taker_received_at is null or maker_sent_at is not null)
  ),
  constraint settlements_dispute_complete check (
    (disputed_at is null) = (disputed_by is null) and (disputed_at is null) = (dispute_reason is null)
  ),
  constraint settlements_dispute_party check (disputed_by is null or disputed_by in (taker_id, maker_id))
);

create index settlements_taker_idx on public.settlements (taker_id, created_at desc);
create index settlements_maker_idx on public.settlements (maker_id, created_at desc);

-- Garde-fou : caractéristiques figées, étapes définitives, gel après litige, aucune suppression.
create function public.settlements_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un règlement ne peut pas être supprimé.' using errcode = 'restrict_violation';
  end if;

  if new.trade_id <> old.trade_id or new.taker_id <> old.taker_id or new.maker_id <> old.maker_id
     or new.taker_currency <> old.taker_currency or new.taker_amount <> old.taker_amount
     or new.taker_pays_to <> old.taker_pays_to or new.maker_amount <> old.maker_amount
     or new.maker_pays_to <> old.maker_pays_to or new.due_at <> old.due_at
     or new.created_at <> old.created_at then
    raise exception 'Les caractéristiques d''un règlement ne peuvent pas être modifiées.'
      using errcode = 'restrict_violation';
  end if;

  if old.disputed_at is not null then
    raise exception 'Ce règlement fait l''objet d''un litige : il est gelé.' using errcode = 'restrict_violation';
  end if;

  if (old.taker_sent_at is not null and new.taker_sent_at is distinct from old.taker_sent_at)
     or (old.maker_received_at is not null and new.maker_received_at is distinct from old.maker_received_at)
     or (old.maker_sent_at is not null and new.maker_sent_at is distinct from old.maker_sent_at)
     or (old.taker_received_at is not null and new.taker_received_at is distinct from old.taker_received_at) then
    raise exception 'Une étape confirmée ne peut pas être annulée.' using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger settlements_guard
before update or delete on public.settlements
for each row execute function public.settlements_guard();

-- ---------------------------------------------------------------------------
-- Pilote sur invitation
-- ---------------------------------------------------------------------------

create table public.pilot_invites (
  email text primary key check (email = lower(email) and email like '%@%'),
  note text,
  invited_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Droits : lecture de ses propres données uniquement, aucune écriture côté client.
-- ---------------------------------------------------------------------------

revoke all on public.payment_details, public.settlements, public.pilot_invites from anon, authenticated;
grant select on public.payment_details, public.settlements to authenticated;

alter table public.payment_details enable row level security;
alter table public.settlements enable row level security;
alter table public.pilot_invites enable row level security;

create policy "Lire ses propres coordonnées" on public.payment_details
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Lire ses propres règlements" on public.settlements
  for select to authenticated
  using (taker_id = (select auth.uid()) or maker_id = (select auth.uid()));
