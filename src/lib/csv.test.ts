import { describe, it, expect } from 'vitest'
import { parseJournalCsv } from './csv'
import type { Strategy } from '../types'

const strat: Strategy = {
  id: 's1',
  name: 'Breakout Retest',
  description: '',
  target_sample_size: 20,
  status: 'testing',
  created_at: '2026-01-01T00:00:00Z',
}

describe('parseJournalCsv', () => {
  it('parses the export header + resolves strategy by name', () => {
    const csv = [
      'created_at,pair,asset_type,direction,strategy,followed_plan,size_amount,size_currency,entry,take_profit,stop_loss,planned_rr,exit_price,realized_pnl,realized_rr,status,outcome,psychology,reasoning,closed_at',
      '2026-08-01T08:00:00.000Z,btcusdt,crypto,long,Breakout Retest,yes,1000,USD,61000,64000,60000,3,64000,49,3,closed,win,Percaya diri,"Break, retest",2026-08-01T12:00:00.000Z',
    ].join('\n')
    const { rows, errors } = parseJournalCsv(csv, [strat])
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].pair).toBe('BTCUSDT')
    expect(rows[0].strategy_id).toBe('s1')
    expect(rows[0].followed_plan).toBe(true)
    expect(rows[0].entry_price).toBe(61000)
    expect(rows[0].psychology).toBe('Percaya diri')
    expect(rows[0].entry_at).toBe('2026-08-01T08:00:00.000Z')
  })

  it('honours extra V2 columns and skips invalid rows', () => {
    const csv = [
      'pair,entry,take_profit,stop_loss,setup_tags,market_condition,risk_pct,confidence',
      'ETHUSDT,3400,3600,3320,Breakout|Retest,Trending,1.5,8',
      'GARBAGE,,,,,,,', // pair present but no entry/tp/sl -> skipped with error
    ].join('\n')
    const { rows, errors } = parseJournalCsv(csv, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].setup_tags).toEqual(['Breakout', 'Retest'])
    expect(rows[0].market_condition).toBe('Trending')
    expect(rows[0].risk_pct).toBe(1.5)
    expect(rows[0].confidence).toBe(8)
    expect(errors.length).toBe(1)
  })

  it('reports missing required columns', () => {
    const { rows, errors } = parseJournalCsv('foo,bar\n1,2', [])
    expect(rows).toEqual([])
    expect(errors[0]).toMatch(/Kolom wajib hilang/)
  })
})
