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
