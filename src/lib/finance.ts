// Pure trading math — PRD §4.2 (R:R), §4.4 (Expectancy, Profit Factor, Discipline)
import type { JournalEntry, RuleCheck, Strategy } from '../types'
import { DESTRUCTIVE_EMOTIONS } from '../types'
import { toIDR } from './fx'

/** realized P/L of a closed trade, normalised to the base currency (IDR) */
const pnlBase = (e: JournalEntry) => toIDR(e.realized_pnl, e.size_currency)

export const round = (n: number, d = 2) => {
  const f = 10 ** d
  return Math.round((n + Number.EPSILON) * f) / f
}

export function direction(entry: number, tp: number): 'long' | 'short' {
  return tp >= entry ? 'long' : 'short'
}

/**
 * SL must sit on the losing side of entry (below for a long, above for a short).
 * A wrong-side SL turns an "exit at SL" into a fake win — guard the form with this.
 */
export function slOnLossSide(entry: number, tp: number, sl: number): boolean {
  if (sl === entry) return false
  return direction(entry, tp) === 'long' ? sl < entry : sl > entry
}

/** Planned R:R = |TP - Entry| / |Entry - SL| */
export function plannedRR(entry: number, tp: number, sl: number): number | null {
  const risk = Math.abs(entry - sl)
  if (!risk) return null
  return round(Math.abs(tp - entry) / risk, 2)
}

/**
 * Realized P/L in the position's currency.
 * We treat size_amount as notional exposure at entry; return = notional * pct move,
 * signed by trade direction.
 */
export function realizedPnl(t: JournalEntry, exit: number): number {
  if (!t.entry_price) return 0
  const pct = (exit - t.entry_price) / t.entry_price
  const dir = t.direction === 'long' ? 1 : -1
  return round(t.size_amount * pct * dir, 2)
}

/** Realized R:R = achieved reward / planned risk (in price terms), signed. */
export function realizedRR(t: JournalEntry, exit: number): number | null {
  const risk = Math.abs(t.entry_price - t.stop_loss)
  if (!risk) return null
  const dir = t.direction === 'long' ? 1 : -1
  const reward = (exit - t.entry_price) * dir
  return round(reward / risk, 2)
}

export function outcomeOf(pnl: number): 'win' | 'lose' | 'breakeven' {
  if (pnl > 0) return 'win'
  if (pnl < 0) return 'lose'
  return 'breakeven'
}

// ---------- Strategy entry-rule checklist (PRD §8) ----------

/** Strip separators reserved by the Google Sheets `kv` encoding. */
export function sanitizeRule(s: string): string {
  return s.replace(/[;|]/g, ' ').replace(/::/g, ':').replace(/\s+/g, ' ').trim()
}

/** Parse a textarea (one rule per line) into a clean, de-duped, ordered list. */
export function parseRules(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split('\n')) {
    const r = sanitizeRule(line)
    if (r && !seen.has(r.toLowerCase())) {
      seen.add(r.toLowerCase())
      out.push(r)
    }
  }
  return out
}

/** checked / total, or null when the trade has no rule checklist. */
export function ruleCompliance(t: JournalEntry): number | null {
  if (!t.rule_checks || t.rule_checks.length === 0) return null
  const checked = t.rule_checks.filter((r) => r.checked).length
  return round(checked / t.rule_checks.length, 4)
}

/**
 * Re-sync a trade's checklist against a strategy's current rules (used when a
 * trade is edited or its strategy changes): keep the tick state for rules whose
 * text is unchanged, add new rules unchecked, drop removed rules.
 */
export function reconcileRuleChecks(prev: RuleCheck[], currentRules: string[]): RuleCheck[] {
  const wasChecked = new Map(prev.map((r) => [r.rule, r.checked]))
  return currentRules.map((rule) => ({ rule, checked: wasChecked.get(rule) ?? false }))
}

/**
 * Merge an edit into a trade and keep derived fields consistent:
 * `direction` from entry/TP, and — if the trade is closed with an exit —
 * `realized_pnl` / `realized_rr` / `outcome` recomputed from the new prices.
 */
export function applyTradeEdit(t: JournalEntry, patch: Partial<JournalEntry>): JournalEntry {
  const m: JournalEntry = { ...t, ...patch }
  m.direction = direction(m.entry_price, m.take_profit)
  if (m.status === 'closed' && m.exit_price != null) {
    const pnl = realizedPnl(m, m.exit_price)
    m.realized_pnl = pnl
    m.realized_rr = realizedRR(m, m.exit_price)
    m.outcome = outcomeOf(pnl)
  }
  return m
}

// ---------- Strategy aggregate metrics (Strategy League Table) ----------

export interface StrategyStats {
  strategyId: string | null
  name: string
  status: Strategy['status'] | 'none'
  target: number
  closedCount: number
  openCount: number
  sampleReady: boolean
  wins: number
  losses: number
  winRate: number // 0..1
  avgWin: number
  avgLoss: number // positive magnitude
  plannedRRavg: number | null
  realizedRRavg: number | null
  expectancy: number // currency per trade
  profitFactor: number | null
  netPnl: number
}

export function strategyStats(
  strategyId: string | null,
  name: string,
  status: Strategy['status'] | 'none',
  target: number,
  entries: JournalEntry[],
): StrategyStats {
  const mine = entries.filter((e) => e.strategy_id === strategyId)
  const closed = mine.filter((e) => e.status === 'closed')
  const open = mine.filter((e) => e.status === 'open')
  const wins = closed.filter((e) => pnlBase(e) > 0 || e.outcome === 'win')
  const losses = closed.filter((e) => pnlBase(e) < 0 || e.outcome === 'lose')

  const sumWin = wins.reduce((s, e) => s + pnlBase(e), 0)
  const sumLoss = Math.abs(losses.reduce((s, e) => s + pnlBase(e), 0))
  const avgWin = wins.length ? sumWin / wins.length : 0
  const avgLoss = losses.length ? sumLoss / losses.length : 0
  const winRate = closed.length ? wins.length / closed.length : 0
  const lossRate = closed.length ? losses.length / closed.length : 0

  const plannedList = mine
    .map((e) => plannedRR(e.entry_price, e.take_profit, e.stop_loss))
    .filter((n): n is number => n != null)
  const realizedList = closed
    .map((e) => e.realized_rr)
    .filter((n): n is number => n != null)

  const expectancy = winRate * avgWin - lossRate * avgLoss
  const profitFactor = sumLoss > 0 ? sumWin / sumLoss : sumWin > 0 ? Infinity : null

  return {
    strategyId,
    name,
    status,
    target,
    closedCount: closed.length,
    openCount: open.length,
    sampleReady: closed.length >= target,
    wins: wins.length,
    losses: losses.length,
    winRate,
    avgWin: round(avgWin),
    avgLoss: round(avgLoss),
    plannedRRavg: plannedList.length ? round(avg(plannedList), 2) : null,
    realizedRRavg: realizedList.length ? round(avg(realizedList), 2) : null,
    expectancy: round(expectancy),
    profitFactor: profitFactor === null ? null : profitFactor === Infinity ? Infinity : round(profitFactor, 2),
    netPnl: round(sumWin - sumLoss),
  }
}

const avg = (a: number[]) => a.reduce((s, n) => s + n, 0) / a.length

// ---------- Discipline & Emotional Leak (PRD §4.4C) ----------

export interface DisciplineSummary {
  score: number // 0..100
  totalClosed: number
  cleanTrades: number
  brokePlan: number
  emotionalTrades: number
}

export function disciplineSummary(entries: JournalEntry[]): DisciplineSummary {
  const closed = entries.filter((e) => e.status === 'closed')
  const clean = closed.filter(
    (e) => e.followed_plan && !DESTRUCTIVE_EMOTIONS.includes(e.psychology),
  )
  return {
    score: closed.length ? round((clean.length / closed.length) * 100, 0) : 100,
    totalClosed: closed.length,
    cleanTrades: clean.length,
    brokePlan: closed.filter((e) => !e.followed_plan).length,
    emotionalTrades: closed.filter((e) => DESTRUCTIVE_EMOTIONS.includes(e.psychology)).length,
  }
}

export interface LeakSummary {
  leakTotal: number // signed net P/L from destructive-emotion trades
  leakLossOnly: number // sum of losses only (magnitude)
  actualNetPnl: number
  cleanNetPnl: number // portfolio P/L if leak trades removed
  offenders: { emotion: string; count: number; pnl: number }[]
}

export function leakSummary(entries: JournalEntry[]): LeakSummary {
  const closed = entries.filter((e) => e.status === 'closed')
  const leakTrades = closed.filter((e) => DESTRUCTIVE_EMOTIONS.includes(e.psychology))
  const leakTotal = leakTrades.reduce((s, e) => s + pnlBase(e), 0)
  const leakLossOnly = Math.abs(
    leakTrades.filter((e) => pnlBase(e) < 0).reduce((s, e) => s + pnlBase(e), 0),
  )
  const actualNetPnl = closed.reduce((s, e) => s + pnlBase(e), 0)

  const byEmotion = new Map<string, { count: number; pnl: number }>()
  for (const e of leakTrades) {
    const cur = byEmotion.get(e.psychology) ?? { count: 0, pnl: 0 }
    cur.count += 1
    cur.pnl += pnlBase(e)
    byEmotion.set(e.psychology, cur)
  }

  return {
    leakTotal: round(leakTotal),
    leakLossOnly: round(leakLossOnly),
    actualNetPnl: round(actualNetPnl),
    cleanNetPnl: round(actualNetPnl - leakTotal),
    offenders: [...byEmotion.entries()]
      .map(([emotion, v]) => ({ emotion, count: v.count, pnl: round(v.pnl) }))
      .sort((a, b) => a.pnl - b.pnl),
  }
}

// ---------- R:R Execution Gap (PRD §4.4D) ----------

export interface RRGapRow {
  id: string
  pair: string
  planned: number
  realized: number
  gap: number // planned - realized (positive = left money on the table)
}

// ---------- Equity curve (cumulative realized P/L, base currency) ----------

export interface EquityPoint {
  date: string // ISO
  pnl: number // P/L of that trade (IDR)
  cum: number // running total (IDR)
}

export function equityCurve(entries: JournalEntry[]): EquityPoint[] {
  const closed = entries
    .filter((e) => e.status === 'closed' && e.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime())
  let cum = 0
  return closed.map((e) => {
    const pnl = pnlBase(e)
    cum += pnl
    return { date: e.closed_at!, pnl: round(pnl), cum: round(cum) }
  })
}

// ---------- Psychology vs performance (PRD §4.5 point 3) ----------

export interface PsychRow {
  psychology: string
  trades: number
  winRate: number
  netPnl: number // IDR
  avgPnl: number // IDR
}

export function psychologyPerformance(entries: JournalEntry[]): PsychRow[] {
  const closed = entries.filter((e) => e.status === 'closed')
  const by = new Map<string, JournalEntry[]>()
  for (const e of closed) {
    const arr = by.get(e.psychology) ?? []
    arr.push(e)
    by.set(e.psychology, arr)
  }
  return [...by.entries()]
    .map(([psychology, list]) => {
      const wins = list.filter((e) => pnlBase(e) > 0).length
      const net = list.reduce((s, e) => s + pnlBase(e), 0)
      return {
        psychology,
        trades: list.length,
        winRate: list.length ? wins / list.length : 0,
        netPnl: round(net),
        avgPnl: round(net / list.length),
      }
    })
    .sort((a, b) => b.netPnl - a.netPnl)
}

export function rrGapRows(entries: JournalEntry[]): RRGapRow[] {
  return entries
    .filter((e) => e.status === 'closed' && e.realized_rr != null)
    .map((e) => {
      const planned = plannedRR(e.entry_price, e.take_profit, e.stop_loss) ?? 0
      const realized = e.realized_rr ?? 0
      return { id: e.id, pair: e.pair, planned, realized, gap: round(planned - realized, 2) }
    })
    .sort((a, b) => b.gap - a.gap)
}
