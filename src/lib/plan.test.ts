import { describe, it, expect } from 'vitest'
import { planVsActual } from './plan'
import { trade } from '../test/factory'
import type { TradingPlan } from '../types'

const plan: TradingPlan = {
  id: 'p1',
  plan_date: '2026-08-01',
  bias: 'bullish',
  key_levels: [100],
  allowed_setups: ['Breakout'],
  max_trades: 2,
  max_daily_loss_r: 2,
  no_trade_rules: [],
  notes: '',
  created_at: '2026-08-01T00:00:00Z',
}

describe('planVsActual', () => {
  it('flags overtrading, disallowed setups and loss breach', () => {
    const journal = [
      trade({ entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout'], entry: 100, tp: 110, sl: 90, exit: 90 }), // -1R
      trade({ entry_at: '2026-08-01T09:00:00Z', setup_tags: ['Reversal'], entry: 100, tp: 110, sl: 90, exit: 90 }), // -1R, disallowed
      trade({ entry_at: '2026-08-01T10:00:00Z', setup_tags: ['Breakout'], entry: 100, tp: 110, sl: 90, exit: 90, followed_plan: false }), // -1R
      trade({ entry_at: '2026-08-02T08:00:00Z', setup_tags: ['Breakout'], entry: 100, tp: 110, sl: 90, exit: 110 }), // other day
    ]
    const c = planVsActual(plan, journal)
    expect(c.actualTrades).toBe(3)
    expect(c.tradesOver).toBe(true)
    expect(c.disallowedSetups).toEqual(['Reversal'])
    expect(c.realizedR).toBe(-3)
    expect(c.lossBreached).toBe(true)
    expect(c.followedPlanRate).toBeCloseTo(2 / 3, 5)
  })

  it('clean day passes', () => {
    const journal = [
      trade({ entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout'], entry: 100, tp: 120, sl: 90, exit: 120 }),
    ]
    const c = planVsActual(plan, journal)
    expect(c.tradesOver).toBe(false)
    expect(c.lossBreached).toBe(false)
    expect(c.disallowedSetups).toEqual([])
  })
})
