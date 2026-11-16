-- Budgeter database setup. Paste this whole file into the Supabase SQL Editor
-- and press Run. It is safe to run more than once.

-- One row per person.
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  weekly_pay numeric(14,2) not null default 0,
  created_at timestamptz not null default now()
);

-- Spending categories. weekly_limit is a soft limit (warning only).
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  weekly_limit numeric(14,2),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  amount numeric(14,2) not null check (amount > 0),
  type text not null check (type in ('expense', 'income')),
  category_id uuid references categories on delete set null,
  note text,
  source text not null default 'manual' check (source in ('manual', 'slip')),
  slip_ref text, -- transaction reference from a slip QR, used to block duplicates
  created_at timestamptz not null default now(),
  unique (user_id, slip_ref)
);
create index if not exists transactions_user_date on transactions (user_id, date desc);

-- Row Level Security: each person can only see and change their own rows.
alter table profiles enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;

drop policy if exists "own profile" on profiles;
create policy "own profile" on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own categories" on categories;
create policy "own categories" on categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own transactions" on transactions;
create policy "own transactions" on transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- When someone creates an account, give them a profile and starter categories.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  insert into categories (user_id, name)
  select new.id, n from unnest(array['Food', 'Transport', 'Bills', 'Shopping', 'Fun', 'Other']) as n;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();
