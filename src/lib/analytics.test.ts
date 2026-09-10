import { describe, it, expect } from 'vitest'
import {
  bySession,
  byHour,
  bySetupTag,
  byMarketCondition,
  byReason,
  byRuleCompliance,
  reasonKeywords,
  streaks,
  drawdown,
  tradingDNA,
} from './analytics'
import { sessionOf } from '../types'
import { trade } from '../test/factory'

const win = (over: Parameters<typeof trade>[0]) => trade({ entry: 100, tp: 110, sl: 90, exit: 110, ...over })
const loss = (over: Parameters<typeof trade>[0]) => trade({ entry: 100, tp: 110, sl: 90, exit: 90, ...over })

describe('sessionOf (UTC-anchored)', () => {
  it('buckets by UTC hour', () => {
    expect(sessionOf('2026-08-01T03:00:00Z')).toBe('Asia')
    expect(sessionOf('2026-08-01T08:00:00Z')).toBe('London')
    expect(sessionOf('2026-08-01T14:00:00Z')).toBe('London/NY overlap')
    expect(sessionOf('2026-08-01T18:00:00Z')).toBe('New York')
    expect(sessionOf('2026-08-01T23:00:00Z')).toBe('Asia')
  })
})

describe('bySession', () => {
  it('aggregates win rate + expectancy per session, stable order', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z' }), // London win
      loss({ entry_at: '2026-08-02T09:00:00Z' }), // London loss
      win({ entry_at: '2026-08-03T18:00:00Z' }), // NY win
    ]
    const rows = bySession(j)
    const london = rows.find((r) => r.key === 'London')!
    const ny = rows.find((r) => r.key === 'New York')!
    expect(london.trades).toBe(2)
    expect(london.winRate).toBe(0.5)
    expect(ny.trades).toBe(1)
    expect(ny.winRate).toBe(1)
    // order follows TRADING_SESSIONS
    expect(rows.map((r) => r.key)).toEqual(['London', 'New York'])
  })
})

describe('byHour', () => {
  it('keys are zero-padded UTC hours, sorted', () => {
    const rows = byHour([
      win({ entry_at: '2026-08-01T09:00:00Z' }),
      win({ entry_at: '2026-08-01T05:00:00Z' }),
    ])
    expect(rows.map((r) => r.key)).toEqual(['05', '09'])
  })
})

describe('bySetupTag', () => {
  it('a trade with two tags counts in both buckets', () => {
    const rows = bySetupTag([
      win({ entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout', 'Retest'] }),
      loss({ entry_at: '2026-08-02T08:00:00Z', setup_tags: ['Breakout'] }),
    ])
    const bo = rows.find((r) => r.key === 'Breakout')!
    const rt = rows.find((r) => r.key === 'Retest')!
    expect(bo.trades).toBe(2)
    expect(rt.trades).toBe(1)
    expect(rt.winRate).toBe(1)
  })
})

describe('byMarketCondition', () => {
  it('sorts by expectancy desc', () => {
    const rows = byMarketCondition([
      win({ entry_at: '2026-08-01T08:00:00Z', market_condition: 'Trending' }),
      win({ entry_at: '2026-08-02T08:00:00Z', market_condition: 'Trending' }),
      loss({ entry_at: '2026-08-03T08:00:00Z', market_condition: 'Ranging' }),
    ])
    expect(rows[0].key).toBe('Trending')
    expect(rows[rows.length - 1].key).toBe('Ranging')
  })
})

describe('byReason', () => {
  const R = (reasoning: string, over: Parameters<typeof trade>[0]) =>
    trade({ entry: 100, tp: 110, sl: 90, reasoning, ...over } as Parameters<typeof trade>[0])

  it('reasonKeywords matches the TA lexicon (bilingual)', () => {
    const k = reasonKeywords('Break weekly resistance, retest bersih, volume ekspansi')
    expect(k).toContain('Breakout')
    expect(k).toContain('Retest')
    expect(k).toContain('Volume')
    expect(k).toContain('Support/Resistance')
  })

  it('buckets win rate + expectancy by reason keyword', () => {
    const j = [
      R('retest bersih, volume naik', { entry_at: '2026-08-01T08:00:00Z', exit: 110 }),
      R('retest lagi, konfirmasi H4', { entry_at: '2026-08-02T08:00:00Z', exit: 110 }),
      R('FOMO takut ketinggalan candle', { entry_at: '2026-08-03T08:00:00Z', exit: 90 }),
      R('FOMO listing news', { entry_at: '2026-08-04T08:00:00Z', exit: 90 }),
    ]
    const rows = byReason(j)
    const retest = rows.find((r) => r.key === 'Retest')!
    const fomo = rows.find((r) => r.key === 'FOMO / impulsif')!
    expect(retest.trades).toBe(2)
    expect(retest.winRate).toBe(1)
    expect(fomo.trades).toBe(2)
    expect(fomo.winRate).toBe(0)
    // sorted by expectancy desc -> Retest before FOMO
    expect(rows.findIndex((r) => r.key === 'Retest')).toBeLessThan(
      rows.findIndex((r) => r.key === 'FOMO / impulsif'),
    )
  })

  it('learns a recurring free-text term not in the lexicon', () => {
    const j = [
      R('pola cangkir terbentuk rapi', { entry_at: '2026-08-01T08:00:00Z', exit: 110 }),
      R('cangkir dengan handle', { entry_at: '2026-08-02T08:00:00Z', exit: 110 }),
      R('cangkir lagi di H4', { entry_at: '2026-08-03T08:00:00Z', exit: 90 }),
    ]
    expect(byReason(j).some((r) => r.key === '“cangkir”')).toBe(true)
  })
})

describe('byRuleCompliance', () => {
  const rc = (n: number, total = 4) =>
    Array.from({ length: total }, (_, i) => ({ rule: `r${i}`, checked: i < n }))

  it('buckets closed trades by compliance %, stable order, skips no-rule trades', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z', rule_checks: rc(4) }), // 100%
      loss({ entry_at: '2026-08-02T08:00:00Z', rule_checks: rc(2) }), // 50%
      win({ entry_at: '2026-08-03T08:00:00Z', rule_checks: rc(2) }), // 50%
      loss({ entry_at: '2026-08-04T08:00:00Z', rule_checks: [] }), // no rules -> excluded
    ]
    const rows = byRuleCompliance(j)
    expect(rows.map((r) => r.key)).toEqual(['100%', '50–79%'])
    expect(rows.find((r) => r.key === '100%')!.winRate).toBe(1)
    expect(rows.find((r) => r.key === '50–79%')!.trades).toBe(2)
  })
})

describe('streaks', () => {
  it('signed current run + best/worst', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z' }),
      win({ entry_at: '2026-08-02T08:00:00Z' }),
      loss({ entry_at: '2026-08-03T08:00:00Z' }),
      loss({ entry_at: '2026-08-04T08:00:00Z' }),
      loss({ entry_at: '2026-08-05T08:00:00Z' }),
    ]
    const s = streaks(j)
    expect(s.current).toBe(-3)
    expect(s.bestWin).toBe(2)
    expect(s.worstLoss).toBe(-3)
  })
})

describe('drawdown', () => {
  it('tracks peak-to-trough of cumulative P/L', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z', size: 1000 }), // +100 -> cum 100 (peak)
      loss({ entry_at: '2026-08-02T08:00:00Z', size: 1000 }), // -100 -> cum 0, dd -100
      loss({ entry_at: '2026-08-03T08:00:00Z', size: 1000 }), // -100 -> cum -100, dd -200
      win({ entry_at: '2026-08-04T08:00:00Z', size: 3000 }), // +300 -> cum 200
    ]
    const d = drawdown(j)
    // sizes are USD -> IDR factor cancels in ratios; abs values scale by 16000
    expect(d.maxDrawdownAbs).toBe(-200 * 16000)
    expect(d.maxDrawdownPct).toBeCloseTo(-2, 5) // -200 / peak 100
    expect(d.recovery).toBe(300 * 16000)
  })
})

describe('tradingDNA', () => {
  it('picks best setup/market and flags negative-expectancy setups', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout'], market_condition: 'Trending', risk_pct: 1 }),
      win({ entry_at: '2026-08-02T08:00:00Z', setup_tags: ['Breakout'], market_condition: 'Trending', risk_pct: 1.2 }),
      win({ entry_at: '2026-08-03T08:00:00Z', setup_tags: ['Breakout'], market_condition: 'Trending', risk_pct: 0.8 }),
      loss({ entry_at: '2026-08-04T08:00:00Z', setup_tags: ['Reversal'], market_condition: 'Ranging', risk_pct: 2 }),
      loss({ entry_at: '2026-08-05T08:00:00Z', setup_tags: ['Reversal'], market_condition: 'Ranging', risk_pct: 2 }),
      loss({ entry_at: '2026-08-06T08:00:00Z', setup_tags: ['Reversal'], market_condition: 'Ranging', risk_pct: 2 }),
    ]
    const dna = tradingDNA(j)
    expect(dna.bestSetup).toBe('Breakout')
    expect(dna.bestMarket).toBe('Trending')
    expect(dna.strengths).toContain('Setup Breakout')
    expect(dna.weaknesses).toContain('Setup Reversal')
    expect(dna.optimalRisk).toEqual({ lo: 0.8, hi: 1.2 })
  })
})
