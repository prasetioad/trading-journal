// Client-side CSV export (PRD §9 Fase 7). No dependency — build a string, download a Blob.
import type { Analysis, JournalEntry, Strategy } from '../types'
import { plannedRR } from './finance'

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
}

function download(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function exportJournalCsv(journal: JournalEntry[], strategies: Strategy[]) {
  const name = new Map(strategies.map((s) => [s.id, s.name]))
  const csv = toCsv(
    [
      'created_at',
      'pair',
      'asset_type',
      'direction',
      'strategy',
      'followed_plan',
      'size_amount',
      'size_currency',
      'entry',
      'take_profit',
      'stop_loss',
      'planned_rr',
      'exit_price',
      'realized_pnl',
      'realized_rr',
      'status',
      'outcome',
      'psychology',
      'reasoning',
      'closed_at',
    ],
    journal.map((t) => [
      t.created_at,
      t.pair,
      t.asset_type,
      t.direction,
      t.strategy_id ? (name.get(t.strategy_id) ?? 'deleted') : 'Tanpa Strategi',
      t.followed_plan ? 'yes' : 'no',
      t.size_amount,
      t.size_currency,
      t.entry_price,
      t.take_profit,
      t.stop_loss,
      plannedRR(t.entry_price, t.take_profit, t.stop_loss) ?? '',
      t.exit_price ?? '',
      t.realized_pnl ?? '',
      t.realized_rr ?? '',
      t.status,
      t.outcome ?? '',
      t.psychology,
      t.reasoning,
      t.closed_at ?? '',
    ]),
  )
  download(`trading-journal_${stamp()}.csv`, csv)
}

export function exportAnalysesCsv(analyses: Analysis[]) {
  const csv = toCsv(
    [
      'created_at',
      'pair',
      'asset_type',
      'bias',
      'support',
      'resistance',
      'target_price',
      'invalidation_price',
      'technique_tags',
      'notes',
      'status',
      'resolved_at',
    ],
    analyses.map((a) => [
      a.created_at,
      a.pair,
      a.asset_type,
      a.bias,
      a.support ?? '',
      a.resistance ?? '',
      a.target_price,
      a.invalidation_price,
      a.technique_tags.join(' | '),
      a.notes,
      a.status,
      a.resolved_at ?? '',
    ]),
  )
  download(`my-analysis_${stamp()}.csv`, csv)
}
