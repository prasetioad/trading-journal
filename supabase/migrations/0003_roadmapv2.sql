-- Roadmap V2 A0 — extend journal_entries with behavioral/analytics context and
-- add the trading_plans table (plan vs actual). Additive & backwards compatible:
-- existing rows get sensible defaults.

-- ----------------------------------------------------------------------------
-- journal_entries — extended context columns
-- ----------------------------------------------------------------------------
alter table public.journal_entries
  add column if not exists entry_at        timestamptz,
  add column if not exists planned_entry   numeric,
  add column if not exists setup_tags      text[]  default '{}',
  add column if not exists market_condition text
    check (market_condition is null or market_condition in
      ('Trending','Ranging','High volatility','Low volatility','News event')),
  add column if not exists confidence      int     check (confidence is null or confidence between 1 and 10),
  add column if not exists risk_pct        numeric,
  add column if not exists screenshot_ref  text,
  add column if not exists mistakes        text[]  default '{}';

-- backfill entry_at for rows created before this migration
update public.journal_entries set entry_at = created_at where entry_at is null;
alter table public.journal_entries alter column entry_at set default now();

create index if not exists journal_entries_entry_at_idx
  on public.journal_entries (user_id, entry_at desc);

-- ----------------------------------------------------------------------------
-- trading_plans — daily plan, compared against actual trades (Roadmap V2 A5)
-- ----------------------------------------------------------------------------
create table if not exists public.trading_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plan_date date not null,
  bias text not null check (bias in ('bullish','bearish','neutral')),
  key_levels numeric[] default '{}',
  allowed_setups text[] default '{}',
  max_trades int default 3,
  max_daily_loss_r numeric default 2,
  no_trade_rules text[] default '{}',
  notes text default '',
  created_at timestamptz default now(),
  unique (user_id, plan_date)
);
create index if not exists trading_plans_user_idx on public.trading_plans (user_id, plan_date desc);

alter table public.trading_plans enable row level security;
drop policy if exists trading_plans_owner on public.trading_plans;
create policy trading_plans_owner on public.trading_plans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
