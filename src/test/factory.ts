// Test factory for JournalEntry — only what the pure logic modules read.
import type { JournalEntry } from '../types'
import { direction, outcomeOf, realizedPnl, realizedRR } from '../lib/finance'

let n = 0

export interface TradeSpec {
  pair?: string
  strategy_id?: string | null
  followed_plan?: boolean
  size?: number
  currency?: 'IDR' | 'USD'
  entry?: number
  planned_entry?: number | null
  tp?: number
  sl?: number
  psychology?: JournalEntry['psychology']
  setup_tags?: string[]
  market_condition?: JournalEntry['market_condition']
  confidence?: number | null
  risk_pct?: number | null
  mistakes?: string[]
  entry_at: string
  /** close X minutes after entry; omit to leave open */
  closeAfterMin?: number
  exit?: number
}

export function trade(spec: TradeSpec): JournalEntry {
  n++
  const entry = spec.entry ?? 100
  const tp = spec.tp ?? 110
  const sl = spec.sl ?? 95
  const base: JournalEntry = {
    id: `t${n}`,
    asset_type: 'crypto',
    pair: spec.pair ?? 'BTCUSDT',
    strategy_id: spec.strategy_id ?? null,
    followed_plan: spec.followed_plan ?? true,
    size_amount: spec.size ?? 1000,
    size_currency: spec.currency ?? 'USD',
    entry_price: entry,
    take_profit: tp,
    stop_loss: sl,
    direction: direction(entry, tp),
    exit_price: null,
    realized_pnl: null,
    realized_rr: null,
    status: 'open',
    outcome: null,
    psychology: spec.psychology ?? 'Netral',
    reasoning: 'test',
    analyzed_by_ai: false,
    analyzed_at: null,
    closed_at: null,
    created_at: spec.entry_at,
    entry_at: spec.entry_at,
    planned_entry: spec.planned_entry ?? null,
    setup_tags: spec.setup_tags ?? [],
    market_condition: spec.market_condition ?? null,
    confidence: spec.confidence ?? null,
    risk_pct: spec.risk_pct ?? null,
    screenshot_ref: null,
    mistakes: spec.mistakes ?? [],
  }
  if (spec.exit == null) return base
  const pnl = realizedPnl(base, spec.exit)
  const closedAt = new Date(
    new Date(spec.entry_at).getTime() + (spec.closeAfterMin ?? 60) * 60000,
  ).toISOString()
  return {
    ...base,
    status: 'closed',
    exit_price: spec.exit,
    realized_pnl: pnl,
    realized_rr: realizedRR(base, spec.exit),
    outcome: outcomeOf(pnl),
    closed_at: closedAt,
  }
}

export function resetIds() {
  n = 0
}
