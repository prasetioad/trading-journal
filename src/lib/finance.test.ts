import { describe, it, expect } from 'vitest'
import {
  plannedRR,
  realizedPnl,
  realizedRR,
  direction,
  outcomeOf,
  strategyStats,
  disciplineSummary,
  leakSummary,
  equityCurve,
} from './finance'
import { trade } from '../test/factory'
import type { JournalEntry } from '../types'

const AT = '2026-08-01T08:00:00.000Z'

describe('primitives', () => {
  it('plannedRR = |tp-entry| / |entry-sl|', () => {
    expect(plannedRR(100, 110, 95)).toBe(2)
    expect(plannedRR(100, 100, 100)).toBeNull()
  })

  it('direction from tp vs entry', () => {
    expect(direction(100, 110)).toBe('long')
    expect(direction(100, 90)).toBe('short')
  })

  it('realizedPnl scales notional by pct move, signed by direction', () => {
    const long = trade({ entry: 100, tp: 110, sl: 95, size: 1000, entry_at: AT, exit: 110 })
    expect(realizedPnl(long, 110)).toBe(100) // +10%
    const short = trade({ entry: 100, tp: 90, sl: 105, size: 1000, entry_at: AT, exit: 90 })
    expect(realizedPnl(short, 90)).toBe(100) // -10% * short = +100
  })

  it('realizedRR = reward / planned risk, signed', () => {
    const long = trade({ entry: 100, tp: 110, sl: 90, entry_at: AT, exit: 110 })
    expect(realizedRR(long, 110)).toBe(1)
    expect(realizedRR(long, 90)).toBe(-1)
  })

  it('outcomeOf', () => {
    expect(outcomeOf(5)).toBe('win')
    expect(outcomeOf(-5)).toBe('lose')
    expect(outcomeOf(0)).toBe('breakeven')
  })
})

describe('strategyStats', () => {
  const S = 'strat-1'
  const entries: JournalEntry[] = [
    trade({ strategy_id: S, entry: 100, tp: 110, sl: 90, size: 1000, currency: 'USD', entry_at: AT, exit: 110 }), // +100
    trade({ strategy_id: S, entry: 100, tp: 110, sl: 90, size: 1000, currency: 'USD', entry_at: AT, exit: 90 }), // -100
    trade({ strategy_id: S, entry: 100, tp: 130, sl: 90, size: 1000, currency: 'USD', entry_at: AT, exit: 130 }), // +300
  ]

  it('win rate, profit factor, expectancy', () => {
    const s = strategyStats(S, 'Test', 'testing', 20, entries)
    expect(s.closedCount).toBe(3)
    expect(s.wins).toBe(2)
    expect(s.losses).toBe(1)
    expect(s.winRate).toBeCloseTo(2 / 3, 5)
    // gross win 400, gross loss 100 (same FX factor) => PF 4
    expect(s.profitFactor).toBe(4)
    expect(s.expectancy).toBeGreaterThan(0)
    // net = (+100 +300 -100) * USD→IDR
    expect(s.netPnl).toBe(300 * 16000)
    expect(s.sampleReady).toBe(false)
  })
})

describe('discipline & leak', () => {
  it('discipline score = clean / closed', () => {
    const entries = [
      trade({ followed_plan: true, psychology: 'Sabar', entry_at: AT, exit: 110 }),
      trade({ followed_plan: false, psychology: 'Netral', entry_at: AT, exit: 110 }),
      trade({ followed_plan: true, psychology: 'FOMO', entry_at: AT, exit: 90 }),
    ]
    const d = disciplineSummary(entries)
    expect(d.totalClosed).toBe(3)
    expect(d.cleanTrades).toBe(1)
    expect(d.score).toBe(33)
    expect(d.brokePlan).toBe(1)
    expect(d.emotionalTrades).toBe(1)
  })

  it('leak = P/L from destructive-emotion trades', () => {
    const entries = [
      trade({ psychology: 'FOMO', entry: 100, tp: 110, sl: 90, size: 1000, entry_at: AT, exit: 90 }), // -100
      trade({ psychology: 'Sabar', entry: 100, tp: 110, sl: 90, size: 1000, entry_at: AT, exit: 110 }), // +100
    ]
    const l = leakSummary(entries)
    // leakSummary normalises to the IDR base (USD * 16000)
    expect(l.leakTotal).toBe(-100 * 16000)
    expect(l.actualNetPnl).toBe(0)
    expect(l.cleanNetPnl).toBe(100 * 16000) // remove the FOMO loss
  })
})

describe('equityCurve', () => {
  it('accumulates realized P/L in chronological order', () => {
    const entries = [
      trade({ entry: 100, tp: 110, sl: 90, size: 1000, entry_at: '2026-08-02T08:00:00.000Z', exit: 110 }),
      trade({ entry: 100, tp: 110, sl: 90, size: 1000, entry_at: '2026-08-01T08:00:00.000Z', exit: 90 }),
    ]
    const pts = equityCurve(entries)
    expect(pts.map((p) => p.cum)).toEqual([-100 * 16000, 0])
  })
})
