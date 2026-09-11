// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { JournalForm, type TradeDraft } from './JournalForm'
import type { Strategy } from '../../types'

void React

const strat: Strategy = {
  id: 's1',
  name: 'Breakout Retest',
  description: '',
  target_sample_size: 20,
  status: 'testing',
  entry_rules: ['Break level dengan close H4', 'Volume ekspansi', 'Retest bersih'],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function fill(getByLabel = false) {
  void getByLabel
  // pair combobox + numbers + reasoning
  fireEvent.change(screen.getByPlaceholderText('BTCUSDT'), { target: { value: 'BTCUSDT' } })
  fireEvent.change(screen.getByPlaceholderText('1000'), { target: { value: '1000' } })
  fireEvent.change(screen.getByPlaceholderText('61000'), { target: { value: '100' } })
  fireEvent.change(screen.getByPlaceholderText('64000'), { target: { value: '110' } })
  fireEvent.change(screen.getByPlaceholderText('60000'), { target: { value: '95' } })
  fireEvent.change(
    screen.getByPlaceholderText(/Break weekly resistance/),
    { target: { value: 'retest bersih, volume naik' } },
  )
}

describe('JournalForm — entry-rule checklist', () => {
  it('shows the selected strategy rules as a checklist and reports compliance on submit', () => {
    const onSubmit = vi.fn<(d: TradeDraft) => void>()
    render(<JournalForm strategies={[strat]} onSubmit={onSubmit} onCancel={() => {}} />)

    // all three rules rendered, unchecked -> Compliance 0/3
    for (const r of strat.entry_rules) expect(screen.getByText(r)).toBeTruthy()
    expect(screen.getByText(/Compliance 0\/3/)).toBeTruthy()

    // tick the first two
    const boxes = screen
      .getAllByRole('checkbox')
      .filter((b) => strat.entry_rules.some((r) => b.closest('label')?.textContent?.includes(r)))
    fireEvent.click(boxes[0])
    fireEvent.click(boxes[1])
    expect(screen.getByText(/Compliance 2\/3/)).toBeTruthy()

    fill()
    fireEvent.click(screen.getByRole('button', { name: /Simpan trade/ }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const d = onSubmit.mock.calls[0][0]
    expect(d.rule_checks).toEqual([
      { rule: 'Break level dengan close H4', checked: true },
      { rule: 'Volume ekspansi', checked: true },
      { rule: 'Retest bersih', checked: false },
    ])
  })

  it('edit mode reconciles prior checks against the strategy’s current rules', () => {
    const onSubmit = vi.fn<(d: TradeDraft) => void>()
    const initial = {
      id: 't1',
      asset_type: 'crypto' as const,
      pair: 'BTCUSDT',
      strategy_id: 's1',
      followed_plan: true,
      size_amount: 1000,
      size_currency: 'USD' as const,
      entry_price: 100,
      take_profit: 110,
      stop_loss: 95,
      direction: 'long' as const,
      exit_price: null,
      realized_pnl: null,
      realized_rr: null,
      status: 'open' as const,
      outcome: null,
      mode: 'live' as const,
      rule_checks: [
        { rule: 'Break level dengan close H4', checked: true },
        { rule: 'aturan lama yang sudah dihapus', checked: true },
      ],
      psychology: 'Netral' as const,
      reasoning: 'x',
      analyzed_by_ai: false,
      analyzed_at: null,
      closed_at: null,
      created_at: '2026-08-01T00:00:00Z',
      entry_at: '2026-08-01T00:00:00Z',
      planned_entry: null,
      setup_tags: [],
      market_condition: null,
      confidence: null,
      risk_pct: null,
      screenshot_ref: null,
      mistakes: [],
    }
    render(
      <JournalForm strategies={[strat]} initial={initial} onSubmit={onSubmit} onCancel={() => {}} />,
    )
    // kept tick for the still-existing rule, dropped the removed one, new rules unchecked
    expect(screen.getByText(/Compliance 1\/3/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Simpan perubahan/ }))
    const d = onSubmit.mock.calls[0][0]
    expect(d.rule_checks).toEqual([
      { rule: 'Break level dengan close H4', checked: true },
      { rule: 'Volume ekspansi', checked: false },
      { rule: 'Retest bersih', checked: false },
    ])
  })
})

// keep test isolation
import { afterEach } from 'vitest'
afterEach(() => cleanup())
