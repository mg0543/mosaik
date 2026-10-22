-- Profil des participants : prénom, nom et téléphone (facultatif), saisis à l'inscription.
--
-- Le profil est créé automatiquement, dans la même transaction que le compte, à partir des
-- informations transmises à l'inscription. Il n'est modifiable que par le serveur : les
-- métadonnées du compte, elles, restent modifiables par l'utilisateur et ne font pas foi.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(first_name) between 1 and 50),
  last_name text check (char_length(last_name) between 1 and 50),
  -- Numéro international facultatif (+ indicatif puis 7 à 14 chiffres).
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

-- Création du profil avec le compte : si les informations sont invalides, l'inscription
-- échoue entièrement (pas de compte sans profil cohérent).
create function public.create_profile_for_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, first_name, last_name, phone)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'last_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

-- Lecture de son propre profil uniquement, aucune écriture côté client.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
alter table public.profiles enable row level security;

create policy "Lire son propre profil" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));
