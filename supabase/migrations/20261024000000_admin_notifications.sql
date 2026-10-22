-- Super admin, centre d'audit, notifications et suspension de comptes.
--
-- Sécurité : le rôle d'administrateur est rangé dans une table à part, sans aucun droit pour les
-- clients (ni lecture ni écriture). Personne ne peut donc s'attribuer le rôle depuis l'application ;
-- il s'accorde uniquement côté serveur ou base. Le journal d'audit est en ajout seul.

-- ---------------------------------------------------------------------------
-- Rôles
-- ---------------------------------------------------------------------------

create table public.app_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('super_admin')),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null
);

-- ---------------------------------------------------------------------------
-- Suspension (sur le profil, modifiable uniquement par le serveur)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column suspended_at timestamptz,
  add column suspended_reason text check (char_length(suspended_reason) between 3 and 500),
  add constraint profiles_suspension_complete check ((suspended_at is null) = (suspended_reason is null));

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in (
    'trade_matched', 'settlement_step', 'settlement_done', 'dispute_opened', 'dispute_resolved',
    'order_cancelled', 'account_suspended', 'account_reactivated'
  )),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 500),
  link text check (link like '/%'),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- Journal d'audit (ajout seul)
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_role text not null check (actor_role in ('user', 'admin', 'system')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index audit_events_at_idx on public.audit_events (at desc);
create index audit_events_actor_idx on public.audit_events (actor_id, at desc);
create index audit_events_action_idx on public.audit_events (action, at desc);

create function public.audit_events_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seule exception : l'anonymisation de l'auteur quand son compte est supprimé (RGPD),
  -- sans rien changer d'autre à l'événement.
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and new.id = old.id and new.at = old.at and new.actor_role = old.actor_role
     and new.action = old.action and new.entity = old.entity
     and new.entity_id is not distinct from old.entity_id and new.details = old.details then
    return new;
  end if;
  raise exception 'Le journal d''audit ne peut être ni modifié ni effacé.' using errcode = 'restrict_violation';
end;
$$;

create trigger audit_events_append_only
before update or delete on public.audit_events
for each row execute function public.audit_events_append_only();

-- ---------------------------------------------------------------------------
-- Résolution des litiges par l'administrateur
-- ---------------------------------------------------------------------------

alter table public.settlements
  add column resolved_at timestamptz,
  add column resolved_by uuid references auth.users (id) on delete set null,
  add column resolution text check (resolution in ('completed', 'failed')),
  add column resolution_note text check (char_length(resolution_note) between 3 and 1000),
  add constraint settlements_resolution_complete check (
    (resolved_at is null) = (resolution is null) and (resolved_at is null) = (resolution_note is null)
  ),
  add constraint settlements_resolution_needs_dispute check (resolved_at is null or disputed_at is not null);

-- Un règlement en litige reste gelé, sauf pour recevoir une seule décision d'administrateur.
create or replace function public.settlements_guard() returns trigger
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

  if old.resolved_at is not null then
    raise exception 'Ce litige a été tranché : le règlement est définitivement figé.' using errcode = 'restrict_violation';
  end if;

  if old.disputed_at is not null then
    -- Seule évolution permise : la décision de l'administrateur, sans toucher au reste.
    if new.resolved_at is null
       or new.taker_sent_at is distinct from old.taker_sent_at
       or new.maker_received_at is distinct from old.maker_received_at
       or new.maker_sent_at is distinct from old.maker_sent_at
       or new.taker_received_at is distinct from old.taker_received_at
       or new.disputed_at is distinct from old.disputed_at
       or new.disputed_by is distinct from old.disputed_by
       or new.dispute_reason is distinct from old.dispute_reason then
      raise exception 'Ce règlement fait l''objet d''un litige : il est gelé.' using errcode = 'restrict_violation';
    end if;
    return new;
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

-- ---------------------------------------------------------------------------
-- Droits : notifications lisibles par leur destinataire ; rôles et audit invisibles aux clients.
-- ---------------------------------------------------------------------------

revoke all on public.app_roles, public.notifications, public.audit_events from anon, authenticated;
grant select on public.notifications to authenticated;

alter table public.app_roles enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;

create policy "Lire ses propres notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
