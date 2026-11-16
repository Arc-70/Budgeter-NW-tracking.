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

-- ===================== Budget and net worth (added later) =====================

alter table profiles add column if not exists week_start_day int not null default 1 check (week_start_day between 0 and 6);
alter table profiles add column if not exists usd_rate numeric(10,4) not null default 33 check (usd_rate > 0);

-- History of weekly pay, so past weeks keep the pay they had.
create table if not exists pay_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  effective_from date not null,
  amount numeric(14,2) not null check (amount > 0),
  unique (user_id, effective_from)
);

create table if not exists nw_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null default 'asset' check (kind in ('asset', 'liability')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists nw_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  category_id uuid not null references nw_categories on delete cascade,
  name text not null,
  currency text not null default 'THB' check (currency in ('THB', 'USD')),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- One balance per account per day. Each update is kept, which gives the trend line.
create table if not exists nw_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  account_id uuid not null references nw_accounts on delete cascade,
  date date not null,
  balance numeric(16,2) not null check (balance >= 0),
  unique (account_id, date)
);

alter table pay_changes enable row level security;
alter table nw_categories enable row level security;
alter table nw_accounts enable row level security;
alter table nw_balances enable row level security;

drop policy if exists "own pay changes" on pay_changes;
create policy "own pay changes" on pay_changes for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own nw categories" on nw_categories;
create policy "own nw categories" on nw_categories for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own nw accounts" on nw_accounts;
create policy "own nw accounts" on nw_accounts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own nw balances" on nw_balances;
create policy "own nw balances" on nw_balances for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Starter net worth categories for new accounts (replaces the earlier version of this function).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));

  insert into categories (user_id, name)
  select new.id, n from unnest(array['Food', 'Transport', 'Bills', 'Shopping', 'Fun', 'Other']) as n;

  insert into nw_categories (user_id, name, kind) values
    (new.id, 'Bank and cash', 'asset'),
    (new.id, 'Investments', 'asset'),
    (new.id, 'Big assets', 'asset'),
    (new.id, 'Debts', 'liability');

  return new;
end $$;

-- Give the same starter categories to accounts created before this update.
insert into nw_categories (user_id, name, kind)
select p.id, c.name, c.kind
from profiles p
cross join (values ('Bank and cash', 'asset'), ('Investments', 'asset'), ('Big assets', 'asset'), ('Debts', 'liability')) as c(name, kind)
on conflict (user_id, name) do nothing;

-- ===================== Keyword rules (added later) =====================
-- "If the note or slip mentions this keyword, use this category."
create table if not exists category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  keyword text not null,
  category_id uuid not null references categories on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, keyword)
);

alter table category_rules enable row level security;

drop policy if exists "own category rules" on category_rules;
create policy "own category rules" on category_rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===================== Pay plans and the cash pot (added later) =====================

-- One line of a pay plan. Weekly pay arrives every 7 days from start_date;
-- monthly pay on the same day of the month as start_date.
create table if not exists pay_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  interval text not null check (interval in ('weekly', 'monthly')),
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now()
);

-- "I have this much money as of this date." The pot is counted from the newest one.
create table if not exists balance_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table pay_rules enable row level security;
alter table balance_resets enable row level security;

drop policy if exists "own pay rules" on pay_rules;
create policy "own pay rules" on pay_rules for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own balance resets" on balance_resets;
create policy "own balance resets" on balance_resets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Carry over weekly pay set up before pay plans existed (only for people with no plan yet).
insert into pay_rules (user_id, amount, interval, start_date, end_date)
select user_id, amount, 'weekly', effective_from,
       (lead(effective_from) over (partition by user_id order by effective_from)) - 1
from pay_changes pc
where not exists (select 1 from pay_rules pr where pr.user_id = pc.user_id);

-- ===================== Net worth history (added later) =====================

-- Closed accounts leave the current list but stay in history before this date.
alter table nw_accounts add column if not exists closed_on date;

-- A frozen date, kept as its own column in the history table, with that day's USD rate.
create table if not exists nw_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  usd_rate numeric(10,4) not null check (usd_rate > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table nw_snapshots enable row level security;

drop policy if exists "own nw snapshots" on nw_snapshots;
create policy "own nw snapshots" on nw_snapshots for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ===================== Flexible pay intervals and monthly limits (added later) =====================

-- Pay can arrive every N days, weeks or months.
alter table pay_rules add column if not exists every int not null default 1 check (every >= 1);
alter table pay_rules drop constraint if exists pay_rules_interval_check;
alter table pay_rules add constraint pay_rules_interval_check check (interval in ('daily', 'weekly', 'monthly'));

-- A category's soft limit covers a week or a calendar month.
-- (The limit amount itself stays in the weekly_limit column.)
alter table categories add column if not exists limit_period text not null default 'weekly'
  check (limit_period in ('weekly', 'monthly'));
