// Roadmap V2 A5 — Plan vs Actual. Pure; joins a TradingPlan to the trades whose
// entry_at falls on plan_date and flags deviations.
import type { JournalEntry, TradingPlan } from '../types'
import { round } from './finance'

export interface PlanCheck {
  planDate: string
  actualTrades: number
  maxTrades: number
  tradesOver: boolean
  /** sum of realized_rr for the day's closed trades (R multiples) */
  realizedR: number
  maxDailyLossR: number
  lossBreached: boolean
  /** setup tags used that were not in allowed_setups */
  disallowedSetups: string[]
  avgRiskPct: number | null
  followedPlanRate: number | null // fraction of the day's trades with followed_plan
}

export function tradesOnDate(journal: JournalEntry[], date: string): JournalEntry[] {
  return journal.filter((t) => t.entry_at.slice(0, 10) === date)
}

export function planVsActual(plan: TradingPlan, journal: JournalEntry[]): PlanCheck {
  const day = tradesOnDate(journal, plan.plan_date)
  const closed = day.filter((t) => t.status === 'closed')
  const realizedR = round(
    closed.reduce((s, t) => s + (t.realized_rr ?? 0), 0),
    2,
  )
  const allowed = new Set(plan.allowed_setups)
  const disallowed = new Set<string>()
  for (const t of day) for (const tag of t.setup_tags) if (allowed.size && !allowed.has(tag)) disallowed.add(tag)

  const risks = day.map((t) => t.risk_pct).filter((n): n is number => n != null)
  const followed = day.length ? day.filter((t) => t.followed_plan).length / day.length : null

  return {
    planDate: plan.plan_date,
    actualTrades: day.length,
    maxTrades: plan.max_trades,
    tradesOver: day.length > plan.max_trades,
    realizedR,
    maxDailyLossR: plan.max_daily_loss_r,
    lossBreached: realizedR <= -Math.abs(plan.max_daily_loss_r),
    disallowedSetups: [...disallowed],
    avgRiskPct: risks.length ? round(risks.reduce((s, n) => s + n, 0) / risks.length, 2) : null,
    followedPlanRate: followed,
  }
}
