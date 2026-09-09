import { describe, it, expect } from 'vitest'
import { parseQuery, runSearch } from './search'
import { trade } from '../test/factory'

describe('parseQuery', () => {
  it('extracts pair, setup, session and risk criteria', () => {
    const p = parseQuery('BTC breakout london risk < 1.5% 6 bulan terakhir')
    const joined = p.criteria.join(' | ')
    expect(joined).toMatch(/BTC/)
    expect(joined).toMatch(/Breakout/)
    expect(joined).toMatch(/London/)
    expect(joined).toMatch(/risk < 1.5%/)
    expect(joined).toMatch(/6 bulan terakhir/)
  })

  it('predicate matches the intended trades', () => {
    const j = [
      trade({ pair: 'BTCUSDT', entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout'], risk_pct: 1, exit: 110 }),
      trade({ pair: 'BTCUSDT', entry_at: '2026-08-02T08:00:00Z', setup_tags: ['Breakout'], risk_pct: 2.5, exit: 90 }),
      trade({ pair: 'ETHUSDT', entry_at: '2026-08-03T08:00:00Z', setup_tags: ['Breakout'], risk_pct: 1, exit: 110 }),
      trade({ pair: 'BTCUSDT', entry_at: '2026-08-04T18:00:00Z', setup_tags: ['Breakout'], risk_pct: 1, exit: 110 }), // NY session
    ]
    const { predicate } = parseQuery('btc breakout london risk < 2%')
    const hits = j.filter(predicate)
    expect(hits).toHaveLength(1)
    expect(hits[0].pair).toBe('BTCUSDT')
  })
})

describe('runSearch', () => {
  it('aggregates win rate / expectancy over the matched set', () => {
    const j = [
      trade({ pair: 'BTCUSDT', entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout'], entry: 100, tp: 110, sl: 90, exit: 110 }),
      trade({ pair: 'BTCUSDT', entry_at: '2026-08-02T08:00:00Z', setup_tags: ['Breakout'], entry: 100, tp: 110, sl: 90, exit: 90 }),
    ]
    const r = runSearch(j, [], 'btc breakout')
    expect(r.stats.count).toBe(2)
    expect(r.stats.winRate).toBe(0.5)
    expect(r.stats.profitFactor).toBe(1)
  })

  it('empty query returns everything', () => {
    const j = [trade({ entry_at: '2026-08-01T08:00:00Z' })]
    expect(runSearch(j, [], '   ').trades).toHaveLength(1)
  })
})
