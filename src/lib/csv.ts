// Client-side CSV export + import (PRD §9 Fase 7 / Roadmap V2 A10).
// No dependency — build/parse a string, download a Blob.
import type {
  AssetType,
  Currency,
  JournalEntry,
  MarketCondition,
  Psychology,
  RuleCheck,
  Strategy,
  TradeMode,
} from '../types'
import type { Analysis } from '../types'
import { MARKET_CONDITIONS, PSYCHOLOGY } from '../types'
import { plannedRR } from './finance'

/** encode/decode rule_checks as "rule::1 ; rule2::0" (matches google-apps-script kv) */
export function encodeRuleChecks(rc: RuleCheck[]): string {
  return (rc ?? [])
    .map((r) => `${String(r.rule).replace(/[;|]/g, ' ')}::${r.checked ? 1 : 0}`)
    .join(' ; ')
}
export function decodeRuleChecks(s: string): RuleCheck[] {
  if (!s.trim()) return []
  return s
    .split(';')
    .map((part) => {
      const i = part.lastIndexOf('::')
      if (i < 0) return null
      return { rule: part.slice(0, i).trim(), checked: part.slice(i + 2).trim() === '1' }
    })
    .filter((x): x is RuleCheck => !!x && !!x.rule)
}

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

export function exportJournalCsv(
  journal: JournalEntry[],
  strategies: Strategy[],
  filename = `trading-journal_${stamp()}.csv`,
) {
  const name = new Map(strategies.map((s) => [s.id, s.name]))
  const csv = toCsv(
    [
      'created_at',
      'entry_at',
      'mode',
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
      'rule_checks',
      'closed_at',
    ],
    journal.map((t) => [
      t.created_at,
      t.entry_at,
      t.mode,
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
      encodeRuleChecks(t.rule_checks),
      t.closed_at ?? '',
    ]),
  )
  download(filename, csv)
}

// ---------------------------------------------------------------------------
// Import (Roadmap V2 A10) — parse the journal export format back to drafts.
// Rows always import as OPEN positions (exit data is ignored). Extra columns
// setup_tags | market_condition | confidence | risk_pct | planned_entry are
// honoured when present.
// ---------------------------------------------------------------------------

export interface ImportedTrade {
  asset_type: AssetType
  pair: string
  strategy_id: string | null
  followed_plan: boolean
  size_amount: number
  size_currency: Currency
  entry_price: number
  take_profit: number
  stop_loss: number
  psychology: Psychology
  reasoning: string
  entry_at: string
  planned_entry: number | null
  setup_tags: string[]
  market_condition: MarketCondition | null
  confidence: number | null
  risk_pct: number | null
  screenshot_ref: null
  mistakes: string[]
  mode: TradeMode
  rule_checks: RuleCheck[]
}

export interface ParseResult {
  rows: ImportedTrade[]
  errors: string[]
}

/** Minimal RFC-4180-ish CSV row splitter (handles quotes + embedded commas/newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i++
        } else inQ = false
      } else cur += ch
    } else if (ch === '"') inQ = true
    else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cur)
      cur = ''
      if (row.some((c) => c !== '')) rows.push(row)
      row = []
    } else cur += ch
  }
  if (cur !== '' || row.length) {
    row.push(cur)
    if (row.some((c) => c !== '')) rows.push(row)
  }
  return rows
}

export function parseJournalCsv(
  text: string,
  strategies: Strategy[],
  defaultMode: TradeMode = 'live',
): ParseResult {
  const clean = text.replace(/^﻿/, '')
  const table = parseCsv(clean)
  const errors: string[] = []
  if (table.length < 2) return { rows: [], errors: ['CSV kosong atau tanpa baris data.'] }

  const header = table[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const need = ['pair', 'entry', 'take_profit', 'stop_loss']
  const missing = need.filter((n) => col(n) === -1)
  if (missing.length) return { rows: [], errors: [`Kolom wajib hilang: ${missing.join(', ')}`] }

  const byName = new Map(strategies.map((s) => [s.name.toLowerCase(), s.id]))
  const rows: ImportedTrade[] = []

  for (let r = 1; r < table.length; r++) {
    const line = table[r]
    const get = (name: string) => {
      const i = col(name)
      return i === -1 ? '' : (line[i] ?? '').trim()
    }
    const numOr = (v: string, d: number | null) => (v === '' || Number.isNaN(Number(v)) ? d : Number(v))
    const entry = numOr(get('entry') || get('entry_price'), null)
    const tp = numOr(get('take_profit'), null)
    const sl = numOr(get('stop_loss'), null)
    if (entry == null || tp == null || sl == null || !get('pair')) {
      errors.push(`Baris ${r + 1}: pair/entry/tp/sl tidak valid — dilewati.`)
      continue
    }
    const psychRaw = get('psychology')
    const psychology = (PSYCHOLOGY as readonly string[]).includes(psychRaw)
      ? (psychRaw as Psychology)
      : 'Netral'
    const mcRaw = get('market_condition')
    const market_condition = (MARKET_CONDITIONS as readonly string[]).includes(mcRaw)
      ? (mcRaw as MarketCondition)
      : null
    const stratName = get('strategy').toLowerCase()

    rows.push({
      asset_type: get('asset_type') === 'stock' ? 'stock' : 'crypto',
      pair: get('pair').toUpperCase(),
      strategy_id: stratName ? (byName.get(stratName) ?? null) : null,
      followed_plan: !/^(no|false|0|tidak)$/i.test(get('followed_plan')),
      size_amount: numOr(get('size_amount'), 0) ?? 0,
      size_currency: get('size_currency') === 'USD' ? 'USD' : 'IDR',
      entry_price: entry,
      take_profit: tp,
      stop_loss: sl,
      psychology,
      reasoning: get('reasoning') || 'Imported',
      entry_at: parseDate(get('entry_at') || get('created_at')),
      planned_entry: numOr(get('planned_entry'), null),
      setup_tags: (get('setup_tags') || '')
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean),
      market_condition,
      confidence: numOr(get('confidence'), null),
      risk_pct: numOr(get('risk_pct'), null),
      screenshot_ref: null,
      mistakes: [],
      mode: get('mode') === 'backtest' ? 'backtest' : defaultMode,
      rule_checks: decodeRuleChecks(get('rule_checks')),
    })
  }
  return { rows, errors }
}

function parseDate(v: string): string {
  const d = v ? new Date(v) : new Date()
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
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
