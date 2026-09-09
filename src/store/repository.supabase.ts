// Supabase implementation of the data layer (async, row-level).
//
// STATUS: written & type-checked, NOT yet wired. The running app uses the
// localStorage `repository`. To activate, see MIGRATION-SUPABASE.md — the store
// switches from whole-DB snapshots to these per-row async calls.
//
// Table/column names match /supabase/migrations/0001_init.sql exactly.
import type { Analysis, JournalEntry, Strategy, TradingPlan } from '../types'
import { supabase } from '../lib/supabase'

function db() {
  if (!supabase) throw new Error('Supabase not configured — set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')
  return supabase
}

/* ---------- row <-> domain mappers ---------- */

const toStrategy = (r: Record<string, unknown>): Strategy => ({
  id: r.id as string,
  name: r.name as string,
  description: (r.description as string) ?? '',
  target_sample_size: (r.target_sample_size as number) ?? 20,
  status: r.status as Strategy['status'],
  created_at: r.created_at as string,
  updated_at: r.updated_at as string,
})

const toJournal = (r: Record<string, unknown>): JournalEntry => ({
  id: r.id as string,
  asset_type: r.asset_type as JournalEntry['asset_type'],
  pair: r.pair as string,
  strategy_id: (r.strategy_id as string) ?? null,
  followed_plan: r.followed_plan as boolean,
  size_amount: Number(r.size_amount),
  size_currency: r.size_currency as JournalEntry['size_currency'],
  entry_price: Number(r.entry_price),
  take_profit: Number(r.take_profit),
  stop_loss: Number(r.stop_loss),
  direction: Number(r.take_profit) >= Number(r.entry_price) ? 'long' : 'short',
  exit_price: r.exit_price == null ? null : Number(r.exit_price),
  realized_pnl: r.realized_pnl == null ? null : Number(r.realized_pnl),
  realized_rr: r.realized_rr == null ? null : Number(r.realized_rr),
  status: r.status as JournalEntry['status'],
  outcome: (r.outcome as JournalEntry['outcome']) ?? null,
  mode: (r.mode as JournalEntry['mode']) ?? 'live',
  psychology: r.psychology as JournalEntry['psychology'],
  reasoning: r.reasoning as string,
  analyzed_by_ai: (r.analyzed_by_ai as boolean) ?? false,
  analyzed_at: (r.analyzed_at as string) ?? null,
  closed_at: (r.closed_at as string) ?? null,
  created_at: r.created_at as string,
  entry_at: (r.entry_at as string) ?? (r.created_at as string),
  planned_entry: r.planned_entry == null ? null : Number(r.planned_entry),
  setup_tags: (r.setup_tags as string[]) ?? [],
  market_condition: (r.market_condition as JournalEntry['market_condition']) ?? null,
  confidence: r.confidence == null ? null : Number(r.confidence),
  risk_pct: r.risk_pct == null ? null : Number(r.risk_pct),
  screenshot_ref: (r.screenshot_ref as string) ?? null,
  mistakes: (r.mistakes as string[]) ?? [],
})

const toPlan = (r: Record<string, unknown>): TradingPlan => ({
  id: r.id as string,
  plan_date: r.plan_date as string,
  bias: r.bias as TradingPlan['bias'],
  key_levels: ((r.key_levels as unknown[]) ?? []).map(Number),
  allowed_setups: (r.allowed_setups as string[]) ?? [],
  max_trades: Number(r.max_trades ?? 3),
  max_daily_loss_r: Number(r.max_daily_loss_r ?? 2),
  no_trade_rules: (r.no_trade_rules as string[]) ?? [],
  notes: (r.notes as string) ?? '',
  created_at: r.created_at as string,
})

const toAnalysis = (r: Record<string, unknown>): Analysis => ({
  id: r.id as string,
  pair: r.pair as string,
  asset_type: r.asset_type as Analysis['asset_type'],
  bias: r.bias as Analysis['bias'],
  support: r.support == null ? null : Number(r.support),
  resistance: r.resistance == null ? null : Number(r.resistance),
  target_price: Number(r.target_price),
  invalidation_price: Number(r.invalidation_price),
  technique_tags: (r.technique_tags as string[]) ?? [],
  notes: (r.notes as string) ?? '',
  status: r.status as Analysis['status'],
  resolved_at: (r.resolved_at as string) ?? null,
  analyzed_by_ai: (r.analyzed_by_ai as boolean) ?? false,
  created_at: r.created_at as string,
})

/* ---------- reads ---------- */

export async function fetchAll() {
  const c = db()
  const [s, j, a, p] = await Promise.all([
    c.from('user_strategies').select('*').order('created_at', { ascending: false }),
    c.from('journal_entries').select('*').order('created_at', { ascending: false }),
    c.from('analyses').select('*').order('created_at', { ascending: false }),
    c.from('trading_plans').select('*').order('plan_date', { ascending: false }),
  ])
  if (s.error) throw s.error
  if (j.error) throw j.error
  if (a.error) throw a.error
  if (p.error) throw p.error
  return {
    strategies: (s.data ?? []).map(toStrategy),
    journal: (j.data ?? []).map(toJournal),
    analyses: (a.data ?? []).map(toAnalysis),
    plans: (p.data ?? []).map(toPlan),
  }
}

/* ---------- strategies ---------- */

export async function insertStrategy(
  userId: string,
  s: Pick<Strategy, 'name' | 'description' | 'target_sample_size' | 'status'>,
) {
  const { data, error } = await db()
    .from('user_strategies')
    .insert({ ...s, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return toStrategy(data)
}

export async function updateStrategy(id: string, patch: Partial<Strategy>) {
  const { error } = await db().from('user_strategies').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteStrategy(id: string) {
  const { error } = await db().from('user_strategies').delete().eq('id', id)
  if (error) throw error
}

/* ---------- journal ---------- */

export async function insertTrade(userId: string, t: Partial<JournalEntry>) {
  const { data, error } = await db()
    .from('journal_entries')
    .insert({
      user_id: userId,
      asset_type: t.asset_type,
      pair: t.pair,
      strategy_id: t.strategy_id,
      followed_plan: t.followed_plan,
      size_amount: t.size_amount,
      size_currency: t.size_currency,
      entry_price: t.entry_price,
      take_profit: t.take_profit,
      stop_loss: t.stop_loss,
      psychology: t.psychology,
      reasoning: t.reasoning,
      mode: t.mode ?? 'live',
      entry_at: t.entry_at,
      planned_entry: t.planned_entry,
      setup_tags: t.setup_tags ?? [],
      market_condition: t.market_condition,
      confidence: t.confidence,
      risk_pct: t.risk_pct,
      screenshot_ref: t.screenshot_ref,
      mistakes: t.mistakes ?? [],
      status: 'open',
    })
    .select()
    .single()
  if (error) throw error
  return toJournal(data)
}

export async function patchTrade(id: string, patch: Partial<JournalEntry>) {
  const { error } = await db().from('journal_entries').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteTrade(id: string) {
  const { error } = await db().from('journal_entries').delete().eq('id', id)
  if (error) throw error
}

/* ---------- analyses ---------- */

export async function insertAnalysis(userId: string, a: Partial<Analysis>) {
  const { data, error } = await db()
    .from('analyses')
    .insert({ ...a, user_id: userId, status: 'pending' })
    .select()
    .single()
  if (error) throw error
  return toAnalysis(data)
}

export async function patchAnalysis(id: string, patch: Partial<Analysis>) {
  const { error } = await db().from('analyses').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAnalysis(id: string) {
  const { error } = await db().from('analyses').delete().eq('id', id)
  if (error) throw error
}

/* ---------- trading plans ---------- */

export async function upsertPlan(userId: string, p: Partial<TradingPlan>) {
  const { data, error } = await db()
    .from('trading_plans')
    .upsert(
      {
        user_id: userId,
        plan_date: p.plan_date,
        bias: p.bias,
        key_levels: p.key_levels ?? [],
        allowed_setups: p.allowed_setups ?? [],
        max_trades: p.max_trades,
        max_daily_loss_r: p.max_daily_loss_r,
        no_trade_rules: p.no_trade_rules ?? [],
        notes: p.notes ?? '',
      },
      { onConflict: 'user_id,plan_date' },
    )
    .select()
    .single()
  if (error) throw error
  return toPlan(data)
}

export async function deletePlan(id: string) {
  const { error } = await db().from('trading_plans').delete().eq('id', id)
  if (error) throw error
}
