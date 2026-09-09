// Pure auto-verification logic (PRD §4.2 auto-close, §4.3 prediction resolution).
// The client verifier applies these against live Binance prices; the same rules
// belong in the Supabase Edge Function `price-verifier` for server-side truth.
import type { Analysis, JournalEntry } from '../types'

export interface TradeHit {
  exitPrice: number
  reason: 'tp' | 'sl'
}

/** Did a live price touch TP or SL for an open trade? */
export function checkTrade(t: JournalEntry, price: number): TradeHit | null {
  if (t.status !== 'open') return null
  if (t.direction === 'long') {
    if (price >= t.take_profit) return { exitPrice: t.take_profit, reason: 'tp' }
    if (price <= t.stop_loss) return { exitPrice: t.stop_loss, reason: 'sl' }
  } else {
    if (price <= t.take_profit) return { exitPrice: t.take_profit, reason: 'tp' }
    if (price >= t.stop_loss) return { exitPrice: t.stop_loss, reason: 'sl' }
  }
  return null
}

export interface AnalysisHit {
  status: 'success' | 'fail'
}

/** Did a live price hit the target or the invalidation of a pending analysis? */
export function checkAnalysis(a: Analysis, price: number): AnalysisHit | null {
  if (a.status !== 'pending') return null
  const targetUp = a.target_price >= a.invalidation_price
  if (targetUp) {
    if (price >= a.target_price) return { status: 'success' }
    if (price <= a.invalidation_price) return { status: 'fail' }
  } else {
    if (price <= a.target_price) return { status: 'success' }
    if (price >= a.invalidation_price) return { status: 'fail' }
  }
  return null
}

/** Unrealized P/L of an open trade at a live price (native trade currency). */
export function unrealized(t: JournalEntry, price: number): number {
  if (!t.entry_price) return 0
  const pct = (price - t.entry_price) / t.entry_price
  const dir = t.direction === 'long' ? 1 : -1
  return t.size_amount * pct * dir
}

/** How far (fraction 0..1) price has travelled from entry toward TP. */
export function progressToTP(t: JournalEntry, price: number): number {
  const span = t.take_profit - t.entry_price
  if (!span) return 0
  return clamp01((price - t.entry_price) / span)
}

/** How far (fraction 0..1) price has travelled from entry toward SL. */
export function progressToSL(t: JournalEntry, price: number): number {
  const span = t.stop_loss - t.entry_price
  if (!span) return 0
  return clamp01((price - t.entry_price) / span)
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

export const isCryptoPair = (pair: string) => /^[A-Z0-9]{5,}$/.test(pair) && /USDT$|USDC$|BUSD$|FDUSD$/.test(pair)
