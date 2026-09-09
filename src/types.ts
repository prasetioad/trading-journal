// Domain model — mirrors the Supabase schema in /supabase/migrations (PRD §7).
// The prototype persists these in localStorage; swapping to Supabase later only
// touches src/store/repository.ts.

export type Currency = 'IDR' | 'USD'
export type AssetType = 'crypto' | 'stock'

export type StrategyStatus = 'testing' | 'active' | 'archived'

export interface Strategy {
  id: string
  name: string
  description: string
  target_sample_size: number
  status: StrategyStatus
  created_at: string
  updated_at: string
}

// PRD §4.2 — fixed psychology list
export const PSYCHOLOGY = [
  'Percaya diri',
  'Takut',
  'Serakah',
  'FOMO',
  'Balas dendam',
  'Sabar',
  'Ragu-ragu',
  'Netral',
] as const
export type Psychology = (typeof PSYCHOLOGY)[number]

// Emotions that destroy capital — used by the Emotional Leak detector (PRD §4.4C)
export const DESTRUCTIVE_EMOTIONS: Psychology[] = ['FOMO', 'Balas dendam', 'Serakah']

// Roadmap V2 A0 — extended context fields --------------------------------------

// Suggested setup tags (freeform allowed). Powers "performance by setup" (diskusi.md §A).
export const SETUP_TAGS = [
  'Breakout',
  'Retest',
  'Pullback',
  'Reversal',
  'Supply/Demand',
  'Trend Following',
  'Range',
  'Liquidity Grab',
  'News Play',
  'Divergence',
] as const

// Market regime at entry — powers "performance by market condition" (diskusi.md §F).
export const MARKET_CONDITIONS = [
  'Trending',
  'Ranging',
  'High volatility',
  'Low volatility',
  'News event',
] as const
export type MarketCondition = (typeof MARKET_CONDITIONS)[number]

// Post-hoc execution mistakes — powers behavioral rule engine (rules.ts).
export const MISTAKE_TAGS = [
  'Entry terlalu dini',
  'Entry terlambat',
  'SL digeser',
  'Size kegedean',
  'Cut profit kecepetan',
  'Melawan trend',
  'Overtrading',
  'Tanpa konfirmasi',
  'Abaikan news',
] as const

// Trading sessions by UTC hour — powers "performance by session" (diskusi.md §B).
export const TRADING_SESSIONS = ['Asia', 'London', 'London/NY overlap', 'New York'] as const
export type TradingSession = (typeof TRADING_SESSIONS)[number]

/** Map an ISO timestamp to its trading session (approximate, UTC-based). */
export function sessionOf(iso: string): TradingSession {
  const h = new Date(iso).getUTCHours()
  if (h >= 7 && h < 12) return 'London'
  if (h >= 12 && h < 16) return 'London/NY overlap'
  if (h >= 16 && h < 21) return 'New York'
  return 'Asia'
}

export type TradeStatus = 'open' | 'closed'
export type TradeOutcome = 'win' | 'lose' | 'breakeven'

export interface JournalEntry {
  id: string
  asset_type: AssetType
  pair: string
  strategy_id: string | null // null = "Tanpa Strategi / Eksperimen"
  followed_plan: boolean
  size_amount: number
  size_currency: Currency
  entry_price: number
  take_profit: number
  stop_loss: number
  /** direction is derived from TP vs entry, stored for clarity */
  direction: 'long' | 'short'
  exit_price: number | null
  realized_pnl: number | null
  realized_rr: number | null
  status: TradeStatus
  outcome: TradeOutcome | null
  psychology: Psychology
  reasoning: string
  analyzed_by_ai: boolean
  analyzed_at: string | null
  closed_at: string | null
  created_at: string

  // Roadmap V2 A0 — extended context (all optional; old rows read fine) --------
  /** When the position was actually entered (may differ from created_at). */
  entry_at: string
  /** Price the plan called for, to measure late/early entry vs actual entry_price. */
  planned_entry: number | null
  /** Setup tags — a trade can belong to several (e.g. ['Breakout','Retest']). */
  setup_tags: string[]
  market_condition: MarketCondition | null
  /** Self-rated conviction at entry, 1..10. */
  confidence: number | null
  /** Risk as % of account equity, for risk-creep detection. */
  risk_pct: number | null
  /** Screenshot reference — data: URL (prototype) or Storage path (Supabase). */
  screenshot_ref: string | null
  /** Execution mistakes tagged after the fact. */
  mistakes: string[]
}

// Roadmap V2 A5 — Trading Plan (plan vs actual) -------------------------------
export type PlanBias = 'bullish' | 'bearish' | 'neutral'

export interface TradingPlan {
  id: string
  plan_date: string // YYYY-MM-DD
  bias: PlanBias
  key_levels: number[]
  allowed_setups: string[]
  max_trades: number
  /** Max daily loss expressed in R multiples, e.g. 2 → stop at -2R. */
  max_daily_loss_r: number
  no_trade_rules: string[]
  notes: string
  created_at: string
}

export type AnalysisBias = 'bullish' | 'bearish'
export type AnalysisStatus = 'pending' | 'success' | 'fail'

export interface Analysis {
  id: string
  pair: string
  asset_type: AssetType
  bias: AnalysisBias
  support: number | null
  resistance: number | null
  target_price: number
  invalidation_price: number
  technique_tags: string[]
  notes: string
  status: AnalysisStatus
  resolved_at: string | null
  analyzed_by_ai: boolean
  created_at: string
}
