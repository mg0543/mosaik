-- Intégrité des enregistrements financiers, imposée par la base elle-même.
--
-- Même en cas de bug du serveur, la base refuse :
-- - toute modification ou suppression d'un échange conclu (journal en ajout seul) ;
-- - toute modification des caractéristiques d'un ordre (propriétaire, sens, montant, taux,
--   ordre d'arrivée, date) et toute suppression d'ordre (on annule, on n'efface pas) ;
-- - toute transition de statut impossible (un ordre servi ou annulé reste terminé) ;
-- - toute augmentation du reste ou diminution du reste technique.
-- Le vidage complet (TRUNCATE), réservé à l'administrateur, reste possible pour les tests locaux.

-- Un ordre ne peut jamais avoir échangé plus que son montant.
alter table public.orders
  add constraint orders_accounting check (remaining + leftover <= amount);

create function public.trades_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Les échanges conclus ne peuvent être ni modifiés ni supprimés.'
    using errcode = 'restrict_violation';
end;
$$;

create trigger trades_append_only
before update or delete on public.trades
for each row execute function public.trades_append_only();

create function public.orders_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Un ordre ne peut pas être supprimé : il doit être annulé.'
      using errcode = 'restrict_violation';
  end if;

  if new.id <> old.id or new.owner_id <> old.owner_id or new.side <> old.side
     or new.amount <> old.amount or new.limit_rate <> old.limit_rate
     or new.seq <> old.seq or new.created_at <> old.created_at then
    raise exception 'Les caractéristiques d''un ordre ne peuvent pas être modifiées.'
      using errcode = 'restrict_violation';
  end if;

  if old.status <> 'open' then
    raise exception 'Un ordre % ne peut plus être modifié.', old.status
      using errcode = 'restrict_violation';
  end if;

  if new.remaining > old.remaining or new.leftover < old.leftover then
    raise exception 'Le reste d''un ordre ne peut que diminuer.'
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

create trigger orders_guard
before update or delete on public.orders
for each row execute function public.orders_guard();
