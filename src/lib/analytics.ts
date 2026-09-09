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

// ---------- performance by reason (free-text `reasoning`) ----------

/** Canonical TA vocabulary (bilingual) matched against the reasoning text. */
const REASON_LEXICON: { label: string; re: RegExp }[] = [
  { label: 'Retest', re: /\bre-?test/i },
  { label: 'Breakout', re: /break\s?out|\bbreak\b|tembus/i },
  { label: 'Volume', re: /\bvolume\b|\bvol\b/i },
  { label: 'Demand zone', re: /\bdemand\b/i },
  { label: 'Supply zone', re: /\bsupply\b/i },
  { label: 'BOS / struktur', re: /\bbos\b|break of structure|market structure|struktur/i },
  { label: 'Rejection / wick', re: /rejection|\breject\b|\bwick\b/i },
  { label: 'Divergence', re: /divergen(?:ce|si)?/i },
  { label: 'Support/Resistance', re: /support|resist|\bs\/?r\b|\bsnr\b|\bsnd\b/i },
  { label: 'Trendline', re: /trend\s?line|garis tren|downtrend line|uptrend line/i },
  { label: 'EMA / MA', re: /\bema\s?\d*\b|\bma\s?\d+\b|moving average/i },
  { label: 'Fibonacci', re: /fib(?:onacci)?/i },
  { label: 'Swing high/low', re: /swing\s?(?:high|low|point)?/i },
  { label: 'News / listing', re: /\bnews\b|berita|listing|rilis data/i },
  { label: 'Konfirmasi', re: /konfirmasi|\bconfirm/i },
  { label: 'HH-HL / struktur naik', re: /higher low|higher high|hh[-\s]?hl|lower high|lower low/i },
  { label: 'Liquidity / sweep', re: /liquidity|likuiditas|liq\.? grab|sweep|grab/i },
  { label: 'Range / konsolidasi', re: /\brange\b|konsolidasi|sideways/i },
  { label: 'Pullback / koreksi', re: /pull\s?back|koreksi/i },
  { label: 'Zona belum mitigasi', re: /mitigasi|un-?mitigat|belum.*mitigasi|fresh zone/i },
  { label: 'ATH', re: /\bath\b|all[-\s]?time high/i },
  { label: 'RSI', re: /\brsi\b/i },
  { label: 'Overbought/oversold', re: /overbought|oversold|jenuh (?:beli|jual)/i },
  { label: 'FOMO / impulsif', re: /\bfomo\b|takut ketinggalan|impuls/i },
  { label: 'Revenge', re: /revenge|balas dendam/i },
  { label: 'Order block', re: /order block|\bob\b/i },
  { label: 'Fair value gap', re: /\bfvg\b|fair value gap|imbalance/i },
  { label: 'Inverse H&S / pola', re: /inverse h&s|head\s?and\s?shoulders|h&s|double (?:top|bottom)/i },
  { label: 'Eksperimen / hype', re: /eksperimen|hype|meme|ikut(?:-ikutan)?/i },
]

const REASON_STOPWORDS = new Set([
  'di', 'ke', 'dari', 'yang', 'dan', 'atau', 'untuk', 'pada', 'dengan', 'saat', 'sudah',
  'belum', 'tapi', 'tanpa', 'ini', 'itu', 'ada', 'jadi', 'akan', 'masih', 'lalu', 'karena',
  'agar', 'bukan', 'saya', 'kita', 'juga', 'buat', 'kalau', 'bisa', 'lebih', 'tetap',
  'lagi', 'atas', 'bawah', 'setelah', 'sebelum', 'langsung', 'jelas', 'orang', 'lihat',
  'waktu', 'dekat', 'kena', 'sampai', 'sekitar', 'valid', 'bersih', 'rapi', 'kuat',
  'cepat', 'besar', 'kecil', 'lama', 'baru', 'sini', 'situ', 'nya', 'padahal', 'tengah',
  'high', 'low', 'candle', 'close',
  'the', 'and', 'for', 'with', 'after', 'before', 'from', 'into', 'over', 'entry', 'exit',
  'trade', 'target', 'harga', 'price', 'level', 'setup', 'masuk', 'keluar', 'posisi',
])

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !REASON_STOPWORDS.has(w) && !/^\d+$/.test(w))

/** Reason keywords a single trade matches: lexicon hits + notable free tokens. */
export function reasonKeywords(text: string, extraTerms: Set<string> = new Set()): string[] {
  const hits = new Set<string>()
  for (const { label, re } of REASON_LEXICON) if (re.test(text)) hits.add(label)
  const covered = [...hits].join(' • ').toLowerCase() // suppress free tokens already named by a label
  for (const tok of tokenize(text)) {
    if (!extraTerms.has(tok) || covered.includes(tok)) continue
    hits.add(`“${tok}”`)
  }
  return [...hits]
}

/**
 * Win rate / expectancy grouped by what you wrote in `reasoning`.
 * Combines a curated TA lexicon with any word that recurs across >= `minTrades`
 * closed trades, so it also learns your own vocabulary.
 */
export function byReason(entries: JournalEntry[], minTrades = 2): Bucket[] {
  const closed = closedOf(entries)

  // learn recurring free-text terms
  const freq = new Map<string, number>()
  for (const e of closed) {
    for (const tok of new Set(tokenize(e.reasoning))) freq.set(tok, (freq.get(tok) ?? 0) + 1)
  }
  const extra = new Set([...freq.entries()].filter(([, n]) => n >= Math.max(3, minTrades)).map(([w]) => w))

  const by = new Map<string, JournalEntry[]>()
  for (const e of closed) {
    for (const k of reasonKeywords(e.reasoning, extra)) (by.get(k) ?? by.set(k, []).get(k)!).push(e)
  }

  return [...by.entries()]
    .map(([k, list]) => bucket(k, list))
    .filter((b) => b.trades >= minTrades)
    .sort((a, b) => b.expectancy - a.expectancy || b.trades - a.trades)
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
