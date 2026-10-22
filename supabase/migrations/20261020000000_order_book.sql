-- MEYA : carnet d'ordres EUR / XOF.
--
-- Principes :
-- - Montants en entiers : centimes d'EUR et XOF entiers (bigint). Taux en millièmes de XOF par EUR.
-- - Les contraintes rendent impossibles les états incohérents, même en cas de bug applicatif.
-- - Aucune écriture depuis le navigateur : les clients ne peuvent que lire leurs propres données.
--   Les ordres et les échanges sont écrits uniquement par le serveur, dans une transaction.
-- - Aucun argent n'est déplacé : ces tables enregistrent des appariements, pas des paiements.

create type public.order_side as enum ('SELL_EUR', 'SELL_XOF');
create type public.order_status as enum ('open', 'filled', 'cancelled');

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete restrict,
  side public.order_side not null,
  -- Montant initial et reste, dans la devise donnée : centimes (SELL_EUR) ou XOF (SELL_XOF).
  amount bigint not null check (amount > 0),
  remaining bigint not null check (remaining >= 0 and remaining <= amount),
  -- SELL_EUR : taux minimum accepté. SELL_XOF : taux maximum accepté.
  limit_rate integer not null check (limit_rate > 0),
  -- Ordre d'arrivée, attribué par la base sous le verrou du carnet.
  seq bigint generated always as identity unique,
  status public.order_status not null default 'open',
  -- Reste technique rendu à l'utilisateur (moins d'1 centime à son taux), jamais masqué.
  leftover bigint not null default 0 check (leftover >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un ordre ouvert a toujours un reste ; un ordre servi n'en a plus.
  constraint orders_open_has_remaining check (status <> 'open' or remaining > 0),
  constraint orders_filled_is_empty check (status <> 'filled' or remaining = 0)
);

-- Recherche des contreparties : ordres ouverts d'un côté, triés par taux puis arrivée.
create index orders_book_idx on public.orders (side, limit_rate, seq) where status = 'open';
create index orders_owner_idx on public.orders (owner_id, created_at desc);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  -- Ordre déjà inscrit, dont le taux s'applique.
  maker_order_id uuid not null references public.orders (id) on delete restrict,
  -- Ordre entrant.
  taker_order_id uuid not null references public.orders (id) on delete restrict,
  maker_id uuid not null references auth.users (id) on delete restrict,
  taker_id uuid not null references auth.users (id) on delete restrict,
  eur_cents bigint not null check (eur_cents > 0),
  xof bigint not null check (xof > 0),
  rate integer not null check (rate > 0),
  -- Ordre d'exécution : les échanges d'une même transaction partagent la même date.
  seq bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  constraint trades_distinct_orders check (maker_order_id <> taker_order_id),
  constraint trades_no_self_trade check (maker_id <> taker_id),
  -- Le XOF n'excède jamais la valeur exacte des centimes au taux appliqué.
  constraint trades_xof_within_rate check (xof * 100000 <= eur_cents * rate)
);

create index trades_maker_order_idx on public.trades (maker_order_id);
create index trades_taker_order_idx on public.trades (taker_order_id);
create index trades_maker_idx on public.trades (maker_id, created_at desc);
create index trades_taker_idx on public.trades (taker_id, created_at desc);

-- Mise à jour automatique de updated_at.
create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

-- Sécurité : lecture de ses propres données uniquement, aucune écriture côté client.
-- Supabase accorde par défaut tous les droits aux rôles clients, y compris TRUNCATE que RLS
-- ne filtre pas : on les retire et on ne rend que la lecture aux utilisateurs connectés.
revoke all on public.orders, public.trades from anon, authenticated;
grant select on public.orders, public.trades to authenticated;

alter table public.orders enable row level security;
alter table public.trades enable row level security;

create policy "Lire ses propres ordres" on public.orders
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Lire ses propres échanges" on public.trades
  for select to authenticated
  using (maker_id = (select auth.uid()) or taker_id = (select auth.uid()));

-- Carnet public anonymisé : côté, reste, taux et ordre d'arrivée, sans l'identité des participants.
-- Fonction security definer : elle lit tous les ordres ouverts mais n'expose que ces colonnes.
-- Données de marché publiques, lisibles aussi par les visiteurs (taux du jour sur l'accueil).
--
-- Règle : ne jamais retirer EXECUTE au rôle anon sur une fonction d'un schéma exposé.
-- Avec l'image supabase/postgres 17.6.1.106, un appel refusé faute de droit fait planter le
-- serveur (erreur de segmentation) : n'importe quel visiteur pourrait redémarrer la base.
-- Une fonction réservée aux utilisateurs connectés doit vérifier auth.uid() elle-même.
create function public.order_book()
returns table (side public.order_side, remaining bigint, limit_rate integer, seq bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.side, o.remaining, o.limit_rate, o.seq
  from public.orders o
  where o.status = 'open'
  order by o.side, o.limit_rate, o.seq;
$$;

grant execute on function public.order_book() to anon, authenticated;
