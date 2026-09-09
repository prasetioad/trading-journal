// Roadmap V2 A7 — deterministic natural-language → journal filter.
// "BTC breakout london risk < 1.5% 6 bulan terakhir" → structured criteria.
// No dependency; an AI path (engine) may pre-translate, but this stands alone.
import type { JournalEntry, Strategy } from '../types'
import { MARKET_CONDITIONS, PSYCHOLOGY, SETUP_TAGS, sessionOf } from '../types'
import { round } from './finance'
import { toIDR } from './fx'

export interface ParsedQuery {
  criteria: string[]
  predicate: (t: JournalEntry) => boolean
}

export interface SearchResult {
  parsed: ParsedQuery
  trades: JournalEntry[]
  stats: {
    count: number
    closed: number
    winRate: number
    expectancy: number // IDR
    profitFactor: number | null
    netPnl: number
  }
}

const norm = (s: string) => s.toLowerCase().trim()

export function parseQuery(query: string, strategies: Strategy[] = []): ParsedQuery {
  const q = norm(query)
  const criteria: string[] = []
  const tests: ((t: JournalEntry) => boolean)[] = []

  // ----- pair (substring of the trade's pair, e.g. "btc") -----
  const pairTokens = q.match(/\b([a-z]{2,6})(?:usdt|usdc)?\b/g) ?? []
  const knownBits = ['btc', 'eth', 'sol', 'bnb', 'doge', 'pepe', 'bbca', 'bbri', 'tlkm', 'asii']
  const pairBit = knownBits.find((b) => q.includes(b)) ?? null
  if (pairBit) {
    criteria.push(`pair mengandung "${pairBit.toUpperCase()}"`)
    tests.push((t) => t.pair.toLowerCase().includes(pairBit))
  }
  void pairTokens

  // ----- setup tags -----
  const setups = SETUP_TAGS.filter((s) => q.includes(norm(s)))
  if (setups.length) {
    criteria.push(`setup: ${setups.join(' / ')}`)
    tests.push((t) => t.setup_tags.some((tag) => setups.includes(tag as (typeof SETUP_TAGS)[number])))
  }

  // ----- session -----
  const sess: string[] = []
  if (/\blondon\b/.test(q) && !/overlap/.test(q)) sess.push('London')
  if (/\basia\b/.test(q)) sess.push('Asia')
  if (/new york|\bny\b/.test(q)) sess.push('New York')
  if (/overlap/.test(q)) sess.push('London/NY overlap')
  if (sess.length) {
    criteria.push(`sesi: ${sess.join(' / ')}`)
    tests.push((t) => sess.includes(sessionOf(t.entry_at)))
  }

  // ----- market condition -----
  const mc = MARKET_CONDITIONS.filter((m) => q.includes(norm(m)))
  if (mc.length) {
    criteria.push(`market: ${mc.join(' / ')}`)
    tests.push((t) => !!t.market_condition && mc.includes(t.market_condition))
  }

  // ----- psychology / emotion -----
  const emo = PSYCHOLOGY.filter((p) => q.includes(norm(p)))
  if (/fomo/.test(q) && !emo.includes('FOMO')) emo.push('FOMO')
  if (/revenge|balas dendam/.test(q) && !emo.includes('Balas dendam')) emo.push('Balas dendam')
  if (emo.length) {
    criteria.push(`emosi: ${emo.join(' / ')}`)
    tests.push((t) => emo.includes(t.psychology))
  }

  // ----- risk % comparison -----
  const risk = q.match(/risk\s*(<=?|>=?|di ?bawah|kurang dari|di ?atas|lebih dari)?\s*([\d.]+)\s*%?/)
  if (risk) {
    const val = Number(risk[2])
    const op = risk[1] ?? '<'
    const lt = /<|bawah|kurang/.test(op)
    criteria.push(`risk ${lt ? '<' : '>'} ${val}%`)
    tests.push((t) => t.risk_pct != null && (lt ? t.risk_pct < val : t.risk_pct > val))
  }

  // ----- outcome / status -----
  if (/\bwin\b|menang|profit\b/.test(q)) {
    criteria.push('outcome: win')
    tests.push((t) => (t.realized_pnl ?? 0) > 0)
  }
  if (/\blose\b|\bloss\b|rugi|kalah/.test(q)) {
    criteria.push('outcome: lose')
    tests.push((t) => (t.realized_pnl ?? 0) < 0)
  }
  if (/\bopen\b|posisi terbuka/.test(q)) {
    criteria.push('status: open')
    tests.push((t) => t.status === 'open')
  }
  if (/\bclosed\b|\btutup\b/.test(q)) {
    criteria.push('status: closed')
    tests.push((t) => t.status === 'closed')
  }

  // ----- followed plan -----
  if (/melanggar|langgar sop|tidak sesuai/.test(q)) {
    criteria.push('melanggar SOP')
    tests.push((t) => !t.followed_plan)
  } else if (/sesuai sop|ikut sop|disiplin/.test(q)) {
    criteria.push('sesuai SOP')
    tests.push((t) => t.followed_plan)
  }

  // ----- strategy name -----
  for (const s of strategies) {
    if (s.name && q.includes(norm(s.name))) {
      criteria.push(`strategi: ${s.name}`)
      tests.push((t) => t.strategy_id === s.id)
    }
  }

  // ----- date range -----
  const rel = q.match(/(\d+)\s*(hari|minggu|bulan|tahun)\s*terakhir/)
  let sinceMs: number | null = null
  if (rel) {
    const n = Number(rel[1])
    const unit = rel[2]
    const days = unit === 'hari' ? n : unit === 'minggu' ? n * 7 : unit === 'bulan' ? n * 30 : n * 365
    sinceMs = Date.now() - days * 86400000
    criteria.push(`${n} ${unit} terakhir`)
  } else if (/hari ini/.test(q)) {
    sinceMs = new Date().setHours(0, 0, 0, 0)
    criteria.push('hari ini')
  } else if (/minggu ini/.test(q)) {
    sinceMs = Date.now() - 7 * 86400000
    criteria.push('7 hari terakhir')
  } else if (/bulan ini/.test(q)) {
    const d = new Date()
    sinceMs = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    criteria.push('bulan ini')
  }
  if (sinceMs != null) {
    const s = sinceMs
    tests.push((t) => new Date(t.entry_at).getTime() >= s)
  }

  return {
    criteria,
    predicate: (t) => tests.every((fn) => fn(t)),
  }
}

export function runSearch(
  journal: JournalEntry[],
  strategies: Strategy[],
  query: string,
): SearchResult {
  const parsed = parseQuery(query, strategies)
  const trades = query.trim() ? journal.filter(parsed.predicate) : journal
  const closed = trades.filter((t) => t.status === 'closed')
  const pnl = (t: JournalEntry) => toIDR(t.realized_pnl, t.size_currency)
  const wins = closed.filter((t) => pnl(t) > 0)
  const losses = closed.filter((t) => pnl(t) < 0)
  const sumWin = wins.reduce((s, t) => s + pnl(t), 0)
  const sumLoss = Math.abs(losses.reduce((s, t) => s + pnl(t), 0))
  const winRate = closed.length ? wins.length / closed.length : 0
  const lossRate = closed.length ? losses.length / closed.length : 0
  const avgWin = wins.length ? sumWin / wins.length : 0
  const avgLoss = losses.length ? sumLoss / losses.length : 0

  return {
    parsed,
    trades,
    stats: {
      count: trades.length,
      closed: closed.length,
      winRate: round(winRate, 4),
      expectancy: round(winRate * avgWin - lossRate * avgLoss),
      profitFactor: sumLoss > 0 ? round(sumWin / sumLoss, 2) : sumWin > 0 ? null : null,
      netPnl: round(sumWin - sumLoss),
    },
  }
}
