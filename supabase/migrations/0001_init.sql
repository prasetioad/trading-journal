-- Trading Journal & Analysis — initial schema (PRD v2.1 §7)
-- Apply with: supabase db reset  (local)  or  supabase db push  (linked project)

-- ----------------------------------------------------------------------------
-- 1. user_strategies — Master Playbook
-- ----------------------------------------------------------------------------
create table if not exists public.user_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  target_sample_size int default 20,
  status text default 'testing' check (status in ('testing', 'active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ----------------------------------------------------------------------------
-- 2. journal_entries — Trading Journal
-- ----------------------------------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  asset_type text not null check (asset_type in ('crypto', 'stock')),
  pair text not null,
  strategy_id uuid references public.user_strategies(id) on delete set null,
  followed_plan boolean default true,
  size_amount numeric not null,
  size_currency text default 'IDR' check (size_currency in ('IDR', 'USD')),
  entry_price numeric not null,
  take_profit numeric not null,
  stop_loss numeric not null,
  planned_rr numeric generated always as (
    abs(take_profit - entry_price) / nullif(abs(entry_price - stop_loss), 0)
  ) stored,
  exit_price numeric,
  realized_pnl numeric,
  realized_rr numeric,
  status text default 'open' check (status in ('open', 'closed')),
  outcome text check (outcome in ('win', 'lose', 'breakeven')),
  psychology text not null,
  reasoning text not null,
  analyzed_by_ai boolean default false,
  analyzed_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists journal_entries_user_idx on public.journal_entries (user_id, created_at desc);
create index if not exists journal_entries_unanalyzed_idx
  on public.journal_entries (user_id) where status = 'closed' and analyzed_by_ai = false;

-- ----------------------------------------------------------------------------
-- 3. journal_reason_tags — AI-extracted technique tags
-- ----------------------------------------------------------------------------
create table if not exists public.journal_reason_tags (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid references public.journal_entries(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  tag text not null,
  confidence numeric,
  created_at timestamptz default now()
);
create index if not exists journal_reason_tags_journal_idx on public.journal_reason_tags (journal_id);

-- ----------------------------------------------------------------------------
-- 4. journal_daily_insights — daily AI summary for the dashboard
-- ----------------------------------------------------------------------------
create table if not exists public.journal_daily_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  insight_date date not null default current_date,
  total_trades_analyzed int not null,
  discipline_score numeric,
  emotional_leak_total numeric,
  executive_summary text not null,
  actionable_coach_tip text,
  metrics_breakdown jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, insight_date)
);

-- ----------------------------------------------------------------------------
-- 5. analyses — My Analysis / Prediction
-- ----------------------------------------------------------------------------
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  pair text not null,
  asset_type text not null check (asset_type in ('crypto', 'stock')),
  bias text not null check (bias in ('bullish', 'bearish')),
  support numeric,
  resistance numeric,
  target_price numeric not null,
  invalidation_price numeric not null,
  technique_tags text[] default '{}',
  notes text,
  status text default 'pending' check (status in ('pending', 'success', 'fail')),
  resolved_at timestamptz,
  analyzed_by_ai boolean default false,
  created_at timestamptz default now()
);
create index if not exists analyses_user_idx on public.analyses (user_id, created_at desc);
create index if not exists analyses_pending_idx on public.analyses (status) where status = 'pending';

-- ----------------------------------------------------------------------------
-- 6. analysis_daily_insights — daily AI evaluation of predictions
-- ----------------------------------------------------------------------------
create table if not exists public.analysis_daily_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  insight_date date not null default current_date,
  total_predictions_analyzed int not null,
  hit_rate numeric,
  executive_summary text not null,
  metrics_breakdown jsonb not null,
  created_at timestamptz default now(),
  unique (user_id, insight_date)
);

-- ----------------------------------------------------------------------------
-- updated_at trigger for user_strategies
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_strategies_updated on public.user_strategies;
create trigger trg_user_strategies_updated
  before update on public.user_strategies
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security — every table is per-user (PRD §5)
-- ----------------------------------------------------------------------------
alter table public.user_strategies        enable row level security;
alter table public.journal_entries        enable row level security;
alter table public.journal_reason_tags    enable row level security;
alter table public.journal_daily_insights enable row level security;
alter table public.analyses               enable row level security;
alter table public.analysis_daily_insights enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'user_strategies','journal_entries','journal_reason_tags',
    'journal_daily_insights','analyses','analysis_daily_insights'
  ]
  loop
    execute format('drop policy if exists %I_owner on public.%I', t, t);
    execute format(
      'create policy %I_owner on public.%I
         for all to authenticated
         using (user_id = auth.uid())
         with check (user_id = auth.uid())', t, t);
  end loop;
end $$;
