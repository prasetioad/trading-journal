import { describe, it, expect } from 'vitest'
import { checkTrade, checkTradeRange, checkAnalysis, checkAnalysisRange } from './verify'
import { toYahoo } from './stocks'
import { trade } from '../test/factory'
import type { Analysis } from '../types'

const AT = '2026-08-01T08:00:00Z'

describe('checkTrade (single price)', () => {
  it('long: TP above, SL below', () => {
    const t = trade({ entry: 100, tp: 110, sl: 90, entry_at: AT })
    expect(checkTrade(t, 111)).toEqual({ exitPrice: 110, reason: 'tp' })
    expect(checkTrade(t, 89)).toEqual({ exitPrice: 90, reason: 'sl' })
    expect(checkTrade(t, 100)).toBeNull()
  })
})

describe('checkTradeRange (delayed data — a bar can straddle SL/TP)', () => {
  it('long: SL checked first when both are inside the day range', () => {
    const t = trade({ entry: 100, tp: 110, sl: 90, entry_at: AT })
    expect(checkTradeRange(t, 88, 112)).toEqual({ exitPrice: 90, reason: 'sl' })
    expect(checkTradeRange(t, 95, 112)).toEqual({ exitPrice: 110, reason: 'tp' })
    expect(checkTradeRange(t, 95, 105)).toBeNull()
  })
  it('short: SL (above) checked first', () => {
    const t = trade({ entry: 100, tp: 90, sl: 110, entry_at: AT })
    expect(checkTradeRange(t, 85, 115)).toEqual({ exitPrice: 110, reason: 'sl' })
    expect(checkTradeRange(t, 85, 105)).toEqual({ exitPrice: 90, reason: 'tp' })
  })
  it('ignores non-finite bounds and non-open trades', () => {
    const open = trade({ entry: 100, tp: 110, sl: 90, entry_at: AT })
    expect(checkTradeRange(open, NaN, 200)).toBeNull()
    const closed = trade({ entry: 100, tp: 110, sl: 90, entry_at: AT, exit: 110 })
    expect(checkTradeRange(closed, 0, 999)).toBeNull()
  })
})

const analysis = (over: Partial<Analysis>): Analysis => ({
  id: 'a1',
  pair: 'BBCA',
  asset_type: 'stock',
  bias: 'bullish',
  support: null,
  resistance: null,
  target_price: 110,
  invalidation_price: 90,
  technique_tags: [],
  notes: '',
  status: 'pending',
  resolved_at: null,
  analyzed_by_ai: false,
  created_at: AT,
  ...over,
})

describe('checkAnalysisRange', () => {
  it('target up: invalidation checked first', () => {
    const a = analysis({ target_price: 110, invalidation_price: 90 })
    expect(checkAnalysisRange(a, 88, 112)).toEqual({ status: 'fail' })
    expect(checkAnalysisRange(a, 95, 112)).toEqual({ status: 'success' })
    expect(checkAnalysisRange(a, 95, 105)).toBeNull()
  })
  it('target down (bearish): mirrored', () => {
    const a = analysis({ bias: 'bearish', target_price: 90, invalidation_price: 110 })
    expect(checkAnalysisRange(a, 85, 115)).toEqual({ status: 'fail' })
    expect(checkAnalysisRange(a, 85, 105)).toEqual({ status: 'success' })
  })
  it('single-price checkAnalysis still works', () => {
    const a = analysis({ target_price: 110, invalidation_price: 90 })
    expect(checkAnalysis(a, 111)).toEqual({ status: 'success' })
  })
})

describe('toYahoo', () => {
  it('adds .JK for bare IDX tickers, leaves qualified symbols alone', () => {
    expect(toYahoo('bbca')).toBe('BBCA.JK')
    expect(toYahoo('BBRI')).toBe('BBRI.JK')
    expect(toYahoo('AAPL.US')).toBe('AAPL.US')
    expect(toYahoo(' tlkm ')).toBe('TLKM.JK')
  })
})
