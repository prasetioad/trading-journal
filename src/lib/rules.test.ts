import { describe, it, expect } from 'vitest'
import { behaviorFlags, disciplineScore, autoInsights } from './rules'
import { trade } from '../test/factory'

const win = (o: Parameters<typeof trade>[0]) => trade({ entry: 100, tp: 110, sl: 90, exit: 110, ...o })
const loss = (o: Parameters<typeof trade>[0]) => trade({ entry: 100, tp: 110, sl: 90, exit: 90, ...o })

describe('behaviorFlags — revenge', () => {
  it('flags quick oversized re-entry after a loss', () => {
    const j = [
      loss({ entry_at: '2026-08-01T08:00:00Z', closeAfterMin: 30, size: 1000 }),
      loss({
        entry_at: '2026-08-01T08:40:00Z', // 10 min after prior close
        size: 2000, // +100%
        psychology: 'Balas dendam',
        followed_plan: false,
        risk_pct: 2.5,
      }),
    ]
    const flags = behaviorFlags(j)
    const rev = flags.filter((f) => f.kind === 'revenge')
    expect(rev).toHaveLength(1)
    expect(rev[0].severity).toBe('high')
    expect(rev[0].evidence.join(' ')).toMatch(/Size naik/)
  })

  it('does not flag a re-entry hours later', () => {
    const j = [
      loss({ entry_at: '2026-08-01T08:00:00Z', closeAfterMin: 30 }),
      loss({ entry_at: '2026-08-01T12:00:00Z', size: 2000, psychology: 'Balas dendam' }),
    ]
    expect(behaviorFlags(j).some((f) => f.kind === 'revenge')).toBe(false)
  })
})

describe('behaviorFlags — risk creep', () => {
  it('flags rising risk during a winning streak', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z', risk_pct: 1.0 }),
      win({ entry_at: '2026-08-02T08:00:00Z', risk_pct: 1.2 }),
      win({ entry_at: '2026-08-03T08:00:00Z', risk_pct: 1.5 }),
      win({ entry_at: '2026-08-04T08:00:00Z', risk_pct: 2.2 }),
    ]
    const creep = behaviorFlags(j).filter((f) => f.kind === 'risk-creep')
    expect(creep.length).toBeGreaterThanOrEqual(1)
    expect(creep[0].evidence.join(' ')).toMatch(/beruntun/)
  })
})

describe('behaviorFlags — overtrading', () => {
  it('flags entries beyond the daily threshold', () => {
    const j = [0, 1, 2, 3, 4].map((h) =>
      win({ entry_at: `2026-08-01T0${h + 3}:00:00Z` }),
    )
    const over = behaviorFlags(j).filter((f) => f.kind === 'overtrading')
    expect(over).toHaveLength(1) // 5 trades, threshold 4
  })
})

describe('behaviorFlags — late entry', () => {
  it('flags a long filled 2% above the planned price', () => {
    const j = [
      win({ entry_at: '2026-08-01T08:00:00Z', entry: 102, planned_entry: 100, tp: 120, sl: 95 }),
    ]
    const late = behaviorFlags(j).filter((f) => f.kind === 'late-entry')
    expect(late).toHaveLength(1)
    expect(late[0].severity).toBe('high')
  })
})

describe('behaviorFlags — cut profit early', () => {
  it('flags a winner closed far short of planned R:R', () => {
    const j = [trade({ entry: 100, tp: 130, sl: 90, entry_at: '2026-08-01T08:00:00Z', exit: 105 })]
    const cut = behaviorFlags(j).filter((f) => f.kind === 'cut-profit-early')
    expect(cut).toHaveLength(1)
  })
})

describe('disciplineScore', () => {
  it('stacks penalties and clamps at 0..100', () => {
    const t = loss({
      entry_at: '2026-08-01T08:00:00Z',
      entry: 100,
      tp: 105,
      sl: 90, // planned R:R 0.5 -> <1.5
      followed_plan: false,
      psychology: 'FOMO',
      mistakes: ['Size kegedean'],
    })
    const d = disciplineScore(t, [
      { kind: 'revenge', tradeId: t.id, pair: t.pair, at: t.entry_at, severity: 'high', evidence: [] },
    ])
    // 100 -30 -25 -15 -10 -10
    expect(d.score).toBe(10)
    expect(d.reasons.length).toBe(5)
  })

  it('a clean disciplined trade scores 100', () => {
    const t = win({ entry_at: '2026-08-01T08:00:00Z', entry: 100, tp: 120, sl: 90, psychology: 'Sabar' })
    expect(disciplineScore(t).score).toBe(100)
  })
})

describe('autoInsights', () => {
  it('surfaces an edge and a behavioral pattern', () => {
    const j = [
      // edge: Breakout 3 wins
      win({ entry_at: '2026-08-01T08:00:00Z', setup_tags: ['Breakout'] }),
      win({ entry_at: '2026-08-02T08:00:00Z', setup_tags: ['Breakout'] }),
      win({ entry_at: '2026-08-03T08:00:00Z', setup_tags: ['Breakout'] }),
      // weakness + revenge: Reversal losses, one right after a loss with size up
      loss({ entry_at: '2026-08-04T08:00:00Z', setup_tags: ['Reversal'], closeAfterMin: 20, size: 1000 }),
      loss({
        entry_at: '2026-08-04T08:30:00Z',
        setup_tags: ['Reversal'],
        size: 2500,
        psychology: 'Balas dendam',
        followed_plan: false,
      }),
      loss({ entry_at: '2026-08-05T08:00:00Z', setup_tags: ['Reversal'] }),
    ]
    const ins = autoInsights(j, [])
    expect(ins.some((i) => i.kind === 'edge' && i.title.includes('Breakout'))).toBe(true)
    expect(ins.some((i) => i.kind === 'behavioral')).toBe(true)
    // ranked by magnitude desc
    for (let k = 1; k < ins.length; k++) expect(ins[k - 1].magnitude).toBeGreaterThanOrEqual(ins[k].magnitude)
  })

  it('returns nothing for a tiny sample', () => {
    expect(autoInsights([win({ entry_at: '2026-08-01T08:00:00Z' })], [])).toEqual([])
  })
})
