// Roadmap V2 A2 — behavioral rule engine.
//
//  behaviorFlags()   — named execution-pattern flags per trade
//  disciplineScore() — 0..100 per trade with reasons
//  autoInsights()    — ranked "Your Edge / Weakness / Behavioral / Time / Risk"
//
// Pure; no framework imports.
import type { JournalEntry, Strategy } from '../types'
import { DESTRUCTIVE_EMOTIONS } from '../types'
import { plannedRR, round } from './finance'
import { toIDR } from './fx'
import { bySetupTag, bySession, byHour } from './analytics'

const pnlBase = (e: JournalEntry) => toIDR(e.realized_pnl, e.size_currency)
const sizeBase = (e: JournalEntry) => toIDR(e.size_amount, e.size_currency)
const dayKey = (iso: string) => iso.slice(0, 10)

const REVENGE_WINDOW_MIN = 20
const OVERTRADE_PER_DAY = 4

export type FlagKind =
  | 'revenge'
  | 'risk-creep'
  | 'overtrading'
  | 'late-entry'
  | 'cut-profit-early'

export type Severity = 'low' | 'med' | 'high'

export interface BehaviorFlag {
  kind: FlagKind
  tradeId: string
  pair: string
  at: string
  severity: Severity
  evidence: string[]
}

/** Chronological by entry time; closed trades keep their outcome. */
function chrono(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort(
    (a, b) => new Date(a.entry_at).getTime() - new Date(b.entry_at).getTime(),
  )
}

export function behaviorFlags(entries: JournalEntry[]): BehaviorFlag[] {
  const seq = chrono(entries)
  const flags: BehaviorFlag[] = []

  // ---- revenge trading: quick re-entry after a loss, bigger / emotional ----
  for (let i = 1; i < seq.length; i++) {
    const cur = seq[i]
    // find the most recent trade that had already closed before cur was entered
    const prevClosed = seq
      .slice(0, i)
      .reverse()
      .find((p) => p.closed_at && new Date(p.closed_at) <= new Date(cur.entry_at))
    if (!prevClosed || pnlBase(prevClosed) >= 0) continue
    const gapMin =
      (new Date(cur.entry_at).getTime() - new Date(prevClosed.closed_at!).getTime()) / 60000
    if (gapMin < 0 || gapMin > REVENGE_WINDOW_MIN) continue

    const ev: string[] = [`Entry ${Math.round(gapMin)} menit setelah loss ${prevClosed.pair}`]
    const sizeUp = sizeBase(prevClosed) > 0 ? sizeBase(cur) / sizeBase(prevClosed) - 1 : 0
    if (sizeUp > 0.2) ev.push(`Size naik ${Math.round(sizeUp * 100)}%`)
    if (cur.risk_pct != null && prevClosed.risk_pct != null && cur.risk_pct > prevClosed.risk_pct)
      ev.push(`Risk ${prevClosed.risk_pct}% → ${cur.risk_pct}%`)
    if (cur.psychology === 'Balas dendam') ev.push('Emosi: Balas dendam')
    if (!cur.followed_plan) ev.push('Melanggar SOP')

    if (ev.length >= 2) {
      flags.push({
        kind: 'revenge',
        tradeId: cur.id,
        pair: cur.pair,
        at: cur.entry_at,
        severity: sizeUp > 0.5 || cur.psychology === 'Balas dendam' ? 'high' : 'med',
        evidence: ev,
      })
    }
  }

  // ---- risk creep: risk_pct rising during a win/loss streak ----
  let streakKind = 0
  let streakLen = 0
  for (let i = 0; i < seq.length; i++) {
    const t = seq[i]
    if (t.status !== 'closed') continue
    const k = pnlBase(t) > 0 ? 1 : pnlBase(t) < 0 ? -1 : 0
    if (k !== 0 && k === streakKind) streakLen++
    else {
      streakKind = k
      streakLen = 1
    }
    const prev = seq.slice(0, i).reverse().find((p) => p.status === 'closed' && p.risk_pct != null)
    if (streakLen >= 3 && t.risk_pct != null && prev?.risk_pct != null && t.risk_pct > prev.risk_pct + 0.4) {
      flags.push({
        kind: 'risk-creep',
        tradeId: t.id,
        pair: t.pair,
        at: t.entry_at,
        severity: t.risk_pct >= 2.5 ? 'high' : 'med',
        evidence: [
          `${streakLen}x ${streakKind > 0 ? 'menang' : 'kalah'} beruntun`,
          `Risk ${prev.risk_pct}% → ${t.risk_pct}%`,
        ],
      })
    }
  }

  // ---- overtrading: too many entries in one day ----
  const byDay = new Map<string, JournalEntry[]>()
  for (const t of seq) {
    const d = dayKey(t.entry_at)
    ;(byDay.get(d) ?? byDay.set(d, []).get(d)!).push(t)
  }
  for (const [d, list] of byDay) {
    if (list.length <= OVERTRADE_PER_DAY) continue
    for (const t of list.slice(OVERTRADE_PER_DAY)) {
      flags.push({
        kind: 'overtrading',
        tradeId: t.id,
        pair: t.pair,
        at: t.entry_at,
        severity: list.length >= OVERTRADE_PER_DAY + 3 ? 'high' : 'low',
        evidence: [`${list.length} trade pada ${d} (ambang ${OVERTRADE_PER_DAY})`],
      })
    }
  }

  // ---- late entry: filled far from the planned price (worse side) ----
  for (const t of seq) {
    if (t.planned_entry == null || !t.planned_entry) continue
    const slip = (t.entry_price - t.planned_entry) / t.planned_entry
    const worse = t.direction === 'long' ? slip : -slip // positive = chased
    if (worse >= 0.01) {
      flags.push({
        kind: 'late-entry',
        tradeId: t.id,
        pair: t.pair,
        at: t.entry_at,
        severity: worse >= 0.02 ? 'high' : 'med',
        evidence: [`Entry ${(worse * 100).toFixed(1)}% lebih buruk dari rencana (${t.planned_entry})`],
      })
    }
  }

  // ---- cut profit early: winner closed well short of planned R:R ----
  for (const t of seq) {
    if (t.status !== 'closed' || pnlBase(t) <= 0 || t.realized_rr == null) continue
    const prr = plannedRR(t.entry_price, t.take_profit, t.stop_loss)
    if (prr && t.realized_rr < prr * 0.6 && prr - t.realized_rr >= 0.5) {
      flags.push({
        kind: 'cut-profit-early',
        tradeId: t.id,
        pair: t.pair,
        at: t.entry_at,
        severity: 'low',
        evidence: [`Realized R:R 1:${t.realized_rr} vs rencana 1:${prr}`],
      })
    }
  }

  return flags.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

// ---------- per-trade discipline score ----------

export interface TradeDiscipline {
  tradeId: string
  score: number // 0..100
  reasons: string[]
}

const FLAG_LABEL: Record<FlagKind, string> = {
  revenge: 'Revenge trading',
  'risk-creep': 'Risk creep',
  overtrading: 'Overtrading',
  'late-entry': 'Late entry',
  'cut-profit-early': 'Cut profit kecepetan',
}

export function disciplineScore(
  t: JournalEntry,
  flags: BehaviorFlag[] = [],
): TradeDiscipline {
  let score = 100
  const reasons: string[] = []
  if (!t.followed_plan) {
    score -= 30
    reasons.push('Melanggar SOP (−30)')
  }
  if (DESTRUCTIVE_EMOTIONS.includes(t.psychology)) {
    score -= 25
    reasons.push(`Emosi destruktif: ${t.psychology} (−25)`)
  }
  const mine = flags.filter((f) => f.tradeId === t.id)
  for (const f of mine.slice(0, 3)) {
    score -= 15
    reasons.push(`${FLAG_LABEL[f.kind]} (−15)`)
  }
  if (t.mistakes.length) {
    score -= 10
    reasons.push(`Kesalahan eksekusi: ${t.mistakes.join(', ')} (−10)`)
  }
  const prr = plannedRR(t.entry_price, t.take_profit, t.stop_loss)
  if (prr != null && prr < 1.5) {
    score -= 10
    reasons.push(`Planned R:R < 1:1.5 (−10)`)
  }
  return { tradeId: t.id, score: Math.max(0, Math.min(100, score)), reasons }
}

/** Map of tradeId → discipline for a whole journal (flags computed once). */
export function disciplineByTrade(entries: JournalEntry[]): Map<string, TradeDiscipline> {
  const flags = behaviorFlags(entries)
  return new Map(entries.map((t) => [t.id, disciplineScore(t, flags)]))
}

// ---------- auto insight engine ----------

export type InsightKind = 'edge' | 'weakness' | 'behavioral' | 'time' | 'risk'

export interface Insight {
  kind: InsightKind
  title: string
  detail: string
  magnitude: number // for ranking; higher = more notable
}

export function autoInsights(entries: JournalEntry[], _strategies: Strategy[] = []): Insight[] {
  void _strategies
  const closed = entries.filter((e) => e.status === 'closed')
  const out: Insight[] = []
  if (closed.length < 3) return out

  // edge — best setup tag
  const setups = bySetupTag(entries).filter((b) => b.trades >= 3)
  const best = setups[0]
  if (best && best.expectancy > 0) {
    out.push({
      kind: 'edge',
      title: `Edge: ${best.key}`,
      detail: `${best.trades} trade · win rate ${(best.winRate * 100).toFixed(0)}% · expectancy ${fmtIDR(best.expectancy)}/trade${best.avgRR != null ? ` · avg R 1:${best.avgRR}` : ''}.`,
      magnitude: Math.abs(best.expectancy) * best.trades,
    })
  }

  // weakness — worst setup, and loss concentration
  const worst = setups[setups.length - 1]
  if (worst && worst !== best && worst.expectancy < 0) {
    const totalLoss = setups.reduce((s, b) => s + Math.min(0, b.netPnl), 0)
    const share = totalLoss < 0 ? Math.min(0, worst.netPnl) / totalLoss : 0
    out.push({
      kind: 'weakness',
      title: `Kelemahan: ${worst.key}`,
      detail: `${worst.trades} trade (${((worst.trades / closed.length) * 100).toFixed(0)}% dari total) menghasilkan ${(share * 100).toFixed(0)}% dari total loss. Expectancy ${fmtIDR(worst.expectancy)}/trade.`,
      magnitude: Math.abs(worst.netPnl),
    })
  }

  // behavioral — revenge propensity
  const flags = behaviorFlags(entries)
  const revenge = flags.filter((f) => f.kind === 'revenge')
  if (revenge.length) {
    const afterLoss = entriesEnteredWithinAfterLoss(entries, 10)
    out.push({
      kind: 'behavioral',
      title: 'Pola: revenge trading',
      detail: `${revenge.length} entri terdeteksi sebagai revenge (masuk cepat setelah loss, size/risk naik). ${afterLoss.pct != null ? `Kamu ${afterLoss.pct.toFixed(1)}× lebih sering entry dalam 10 menit setelah loss dibanding baseline.` : ''}`.trim(),
      magnitude: 1000 + revenge.length * 100,
    })
  }
  const riskCreep = flags.filter((f) => f.kind === 'risk-creep')
  if (riskCreep.length) {
    out.push({
      kind: 'behavioral',
      title: 'Pola: risk creep',
      detail: `${riskCreep.length}× risk% naik saat sedang streak. Kunci ukuran risiko sebelum sesi.`,
      magnitude: 800 + riskCreep.length * 80,
    })
  }

  // time — worst session / hour block
  const sess = bySession(entries).filter((b) => b.trades >= 2)
  const worstSess = [...sess].sort((a, b) => a.expectancy - b.expectancy)[0]
  const bestSess = [...sess].sort((a, b) => b.expectancy - a.expectancy)[0]
  if (worstSess && bestSess && worstSess.key !== bestSess.key && worstSess.expectancy < 0) {
    out.push({
      kind: 'time',
      title: `Waktu: sesi ${worstSess.key} merugi`,
      detail: `Sesi ${bestSess.key} expectancy ${fmtIDR(bestSess.expectancy)}/trade, sesi ${worstSess.key} ${fmtIDR(worstSess.expectancy)}/trade. Pertimbangkan tidak trade di sesi ${worstSess.key}.`,
      magnitude: Math.abs(worstSess.netPnl),
    })
  }
  const hours = byHour(entries).filter((b) => b.trades >= 2)
  const lateBad = hours.filter((h) => Number(h.key) >= 13 && h.expectancy < 0)
  if (lateBad.length >= 2) {
    out.push({
      kind: 'time',
      title: 'Waktu: performa turun setelah jam 13:00 UTC',
      detail: `${lateBad.reduce((s, h) => s + h.trades, 0)} trade sore hari dengan expectancy negatif (${lateBad.map((h) => `${h.key}:00`).join(', ')}).`,
      magnitude: Math.abs(lateBad.reduce((s, h) => s + h.netPnl, 0)),
    })
  }

  // risk — high-risk trades vs low-risk
  const withRisk = closed.filter((e) => e.risk_pct != null)
  if (withRisk.length >= 4) {
    const hi = withRisk.filter((e) => e.risk_pct! > 2)
    const lo = withRisk.filter((e) => e.risk_pct! <= 2)
    if (hi.length >= 2 && lo.length >= 2) {
      const expOf = (list: JournalEntry[]) => {
        const w = list.filter((e) => pnlBase(e) > 0)
        const l = list.filter((e) => pnlBase(e) < 0)
        const aw = w.length ? w.reduce((s, e) => s + pnlBase(e), 0) / w.length : 0
        const al = l.length ? Math.abs(l.reduce((s, e) => s + pnlBase(e), 0)) / l.length : 0
        return (w.length / list.length) * aw - (l.length / list.length) * al
      }
      const eHi = expOf(hi)
      const eLo = expOf(lo)
      if (eHi < eLo) {
        out.push({
          kind: 'risk',
          title: 'Risiko: naik di atas 2% menggerus expectancy',
          detail: `Risk ≤2%: expectancy ${fmtIDR(eLo)}/trade (${lo.length} trade). Risk >2%: ${fmtIDR(eHi)}/trade (${hi.length} trade).`,
          magnitude: Math.abs(eLo - eHi) * withRisk.length,
        })
      }
    }
  }

  return out.sort((a, b) => b.magnitude - a.magnitude)
}

function entriesEnteredWithinAfterLoss(
  entries: JournalEntry[],
  minutes: number,
): { pct: number | null } {
  const seq = chrono(entries)
  let afterLoss = 0
  let afterLossQuick = 0
  let afterWin = 0
  let afterWinQuick = 0
  for (let i = 1; i < seq.length; i++) {
    const cur = seq[i]
    const prev = seq
      .slice(0, i)
      .reverse()
      .find((p) => p.closed_at && new Date(p.closed_at) <= new Date(cur.entry_at))
    if (!prev) continue
    const quick =
      (new Date(cur.entry_at).getTime() - new Date(prev.closed_at!).getTime()) / 60000 <= minutes
    if (pnlBase(prev) < 0) {
      afterLoss++
      if (quick) afterLossQuick++
    } else if (pnlBase(prev) > 0) {
      afterWin++
      if (quick) afterWinQuick++
    }
  }
  const lossRate = afterLoss ? afterLossQuick / afterLoss : 0
  const winRate = afterWin ? afterWinQuick / afterWin : 0
  if (!winRate) return { pct: null }
  return { pct: round(lossRate / winRate, 2) }
}

function fmtIDR(n: number): string {
  const s = n < 0 ? '−' : '+'
  return s + 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID')
}
