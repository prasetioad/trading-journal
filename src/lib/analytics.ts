// Roadmap V2 A1 — performance dimensions that finance.ts doesn't cover:
// by hour / session / weekday / setup tag / market condition, plus streaks,
// drawdown and a "Trading DNA" profile. Pure; safe to share with an Edge Function.
//
// All timestamps are read from `entry_at` and bucketed in UTC so results are
// deterministic across machines. `sessionOf` (types.ts) is UTC-anchored too.
import type { JournalEntry, TradingSession } from '../types'
import { TRADING_SESSIONS, sessionOf } from '../types'
import { round } from './finance'
import { toIDR } from './fx'

const pnlBase = (e: JournalEntry) => toIDR(e.realized_pnl, e.size_currency)
const closedOf = (entries: JournalEntry[]) => entries.filter((e) => e.status === 'closed')

export interface Bucket {
  key: string
  trades: number
  wins: number
  losses: number
  winRate: number // 0..1
  netPnl: number // IDR
  avgRR: number | null // mean realized_rr
  expectancy: number // IDR per trade
}

function bucket(key: string, list: JournalEntry[]): Bucket {
  const wins = list.filter((e) => pnlBase(e) > 0)
  const losses = list.filter((e) => pnlBase(e) < 0)
  const sumWin = wins.reduce((s, e) => s + pnlBase(e), 0)
  const sumLoss = Math.abs(losses.reduce((s, e) => s + pnlBase(e), 0))
  const rrs = list.map((e) => e.realized_rr).filter((n): n is number => n != null)
  const winRate = list.length ? wins.length / list.length : 0
  const lossRate = list.length ? losses.length / list.length : 0
  const avgWin = wins.length ? sumWin / wins.length : 0
  const avgLoss = losses.length ? sumLoss / losses.length : 0
  return {
    key,
    trades: list.length,
    wins: wins.length,
    losses: losses.length,
    winRate: round(winRate, 4),
    netPnl: round(sumWin - sumLoss),
    avgRR: rrs.length ? round(rrs.reduce((s, n) => s + n, 0) / rrs.length, 2) : null,
    expectancy: round(winRate * avgWin - lossRate * avgLoss),
  }
}

function groupBy(entries: JournalEntry[], keyOf: (e: JournalEntry) => string | null): Bucket[] {
  const by = new Map<string, JournalEntry[]>()
  for (const e of closedOf(entries)) {
    const k = keyOf(e)
    if (k == null) continue
    ;(by.get(k) ?? by.set(k, []).get(k)!).push(e)
  }
  return [...by.entries()].map(([k, list]) => bucket(k, list))
}

/** Explode multi-valued keys (a trade with 2 setup tags counts in both). */
function groupByMulti(entries: JournalEntry[], keysOf: (e: JournalEntry) => string[]): Bucket[] {
  const by = new Map<string, JournalEntry[]>()
  for (const e of closedOf(entries)) {
    for (const k of keysOf(e)) (by.get(k) ?? by.set(k, []).get(k)!).push(e)
  }
  return [...by.entries()].map(([k, list]) => bucket(k, list))
}

// ---------- dimensions ----------

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

/** UTC hour 0..23, only hours with trades. */
export function byHour(entries: JournalEntry[]): Bucket[] {
  return groupBy(entries, (e) => String(new Date(e.entry_at).getUTCHours()).padStart(2, '0')).sort(
    (a, b) => Number(a.key) - Number(b.key),
  )
}

export function bySession(entries: JournalEntry[]): Bucket[] {
  const found = groupBy(entries, (e) => sessionOf(e.entry_at))
  // stable session order, drop empties
  return TRADING_SESSIONS.map((s) => found.find((b) => b.key === s)).filter(
    (b): b is Bucket => !!b,
  )
}

export function byWeekday(entries: JournalEntry[]): Bucket[] {
  return groupBy(entries, (e) => WEEKDAYS[new Date(e.entry_at).getUTCDay()]).sort(
    (a, b) => WEEKDAYS.indexOf(a.key) - WEEKDAYS.indexOf(b.key),
  )
}

export function bySetupTag(entries: JournalEntry[]): Bucket[] {
  return groupByMulti(entries, (e) => (e.setup_tags.length ? e.setup_tags : ['(tanpa tag)'])).sort(
    (a, b) => b.expectancy - a.expectancy,
  )
}

export function byMarketCondition(entries: JournalEntry[]): Bucket[] {
  return groupBy(entries, (e) => e.market_condition ?? '(tak dicatat)').sort(
    (a, b) => b.expectancy - a.expectancy,
  )
}

// ---------- streaks ----------

export interface Streaks {
  current: number // signed: +3 = 3 wins, -2 = 2 losses
  bestWin: number
  worstLoss: number // negative
}

export function streaks(entries: JournalEntry[]): Streaks {
  const seq = closedOf(entries)
    .filter((e) => e.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())
    .map((e) => pnlBase(e))
    .filter((p) => p !== 0)
    .map((p) => (p > 0 ? 1 : -1))

  let bestWin = 0
  let worstLoss = 0
  let run = 0
  let prev = 0
  for (const s of seq) {
    run = s === prev ? run + s : s
    prev = s
    if (run > bestWin) bestWin = run
    if (run < worstLoss) worstLoss = run
  }
  return { current: run, bestWin, worstLoss }
}

// ---------- drawdown ----------

export interface DrawdownPoint {
  date: string
  cum: number // cumulative realized P/L (IDR)
  peak: number
  ddAbs: number // negative: cum - peak
  ddPct: number // 0..-1 relative to peak (0 when peak <= 0)
}

export interface DrawdownSummary {
  points: DrawdownPoint[]
  maxDrawdownAbs: number // negative
  maxDrawdownPct: number // negative fraction
  recovery: number // gain from trough back to latest cum
}

export function drawdown(entries: JournalEntry[]): DrawdownSummary {
  const closed = closedOf(entries)
    .filter((e) => e.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())

  let cum = 0
  let peak = 0
  let trough = 0
  let maxAbs = 0
  let maxPct = 0
  const points: DrawdownPoint[] = closed.map((e) => {
    cum += pnlBase(e)
    if (cum > peak) peak = cum
    const ddAbs = cum - peak
    const ddPct = peak > 0 ? ddAbs / peak : 0
    if (ddAbs < maxAbs) {
      maxAbs = ddAbs
      trough = cum
    }
    if (ddPct < maxPct) maxPct = ddPct
    return {
      date: e.closed_at!,
      cum: round(cum),
      peak: round(peak),
      ddAbs: round(ddAbs),
      ddPct: round(ddPct, 4),
    }
  })
  return {
    points,
    maxDrawdownAbs: round(maxAbs),
    maxDrawdownPct: round(maxPct, 4),
    recovery: round(cum - trough),
  }
}

// ---------- Trading DNA ----------

export interface TradingDNA {
  bestMarket: string | null
  bestSetup: string | null
  bestSession: TradingSession | null
  bestHour: string | null // UTC hour "14"
  optimalRisk: { lo: number; hi: number } | null // risk_pct range of profitable trades
  strengths: string[]
  weaknesses: string[]
  sampleClosed: number
}

const topBy = (rows: Bucket[], min = 3) =>
  rows.filter((r) => r.trades >= min).sort((a, b) => b.expectancy - a.expectancy)[0] ?? null

export function tradingDNA(entries: JournalEntry[]): TradingDNA {
  const closed = closedOf(entries)
  const setup = topBy(bySetupTag(entries))
  const market = topBy(byMarketCondition(entries))
  const session = topBy(bySession(entries), 2)
  const hour = topBy(byHour(entries), 2)

  const winRisks = closed
    .filter((e) => pnlBase(e) > 0 && e.risk_pct != null)
    .map((e) => e.risk_pct!)
    .sort((a, b) => a - b)
  const optimalRisk = winRisks.length
    ? { lo: winRisks[0], hi: winRisks[winRisks.length - 1] }
    : null

  const strengths: string[] = []
  const weaknesses: string[] = []
  for (const b of bySetupTag(entries)) {
    if (b.trades >= 3 && b.expectancy > 0 && b.winRate >= 0.5) strengths.push(`Setup ${b.key}`)
    if (b.trades >= 3 && b.expectancy < 0) weaknesses.push(`Setup ${b.key}`)
  }
  for (const b of bySession(entries)) {
    if (b.trades >= 3 && b.expectancy < 0) weaknesses.push(`Sesi ${b.key}`)
  }

  return {
    bestMarket: market?.key ?? null,
    bestSetup: setup?.key ?? null,
    bestSession: (session?.key as TradingSession) ?? null,
    bestHour: hour?.key ?? null,
    optimalRisk,
    strengths: [...new Set(strengths)].slice(0, 4),
    weaknesses: [...new Set(weaknesses)].slice(0, 4),
    sampleClosed: closed.length,
  }
}
