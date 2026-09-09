// Deterministic stand-in for the AI Daily Insight Engine (PRD §4.5).
// In production this text comes from a batched Claude call at 17:00 WIB; the
// prototype derives an equivalent briefing straight from the journal data so the
// dashboard widget is fully wired.
import type { JournalEntry, Strategy } from '../types'
import { DESTRUCTIVE_EMOTIONS } from '../types'
import { disciplineSummary, leakSummary, strategyStats } from './finance'
import { autoInsights, behaviorFlags } from './rules'
import { bySession } from './analytics'
import { toIDR } from './fx'
import { money } from './format'

export interface Briefing {
  generatedAt: string
  scope: string
  statusToday: string
  disciplineDiagnosis: string
  hoppingDiagnosis: string
  coachTip: string
  metrics: { label: string; value: string }[]
}

function sameDay(iso: string | null, ref: Date) {
  if (!iso) return false
  const d = new Date(iso)
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  )
}

export function buildBriefing(
  entries: JournalEntry[],
  strategies: Strategy[],
  now = new Date(),
): Briefing {
  const closed = entries.filter((e) => e.status === 'closed')
  // "today" in the prototype = the most recent day that has a closed trade
  const lastClosedDate = closed
    .map((e) => (e.closed_at ? new Date(e.closed_at) : null))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  const ref = lastClosedDate ?? now

  const todays = closed.filter((e) => sameDay(e.closed_at, ref))
  const pool = todays.length ? todays : closed.slice(-5)
  const scope = todays.length ? 'Harian' : 'Ringkasan (5 trade terakhir)'

  const wins = pool.filter((e) => (e.realized_pnl ?? 0) > 0)
  const losses = pool.filter((e) => (e.realized_pnl ?? 0) < 0)
  const net = pool.reduce((s, e) => s + toIDR(e.realized_pnl, e.size_currency), 0)

  const statusToday = pool.length
    ? `${pool.length} trade tercatat: ${wins.length} Win, ${losses.length} Lose. Net P/L ${money(net, 'IDR', { sign: true })}.`
    : 'Belum ada trade yang ditutup. Catat minimal 1 entri untuk mengaktifkan insight.'

  const disc = disciplineSummary(pool)
  const followed = pool.filter((e) => e.followed_plan).length
  const disciplineDiagnosis = pool.length
    ? disc.score >= 80
      ? `Disiplin kuat: ${followed}/${pool.length} trade mengikuti SOP, ${disc.emotionalTrades} trade dipicu emosi destruktif.`
      : `Perlu perhatian: hanya ${followed}/${pool.length} trade sesuai rencana; ${disc.emotionalTrades} trade emosional (${DESTRUCTIVE_EMOTIONS.join('/')}).`
    : '—'

  // hopping = switching strategy right after a loss
  let hops = 0
  const chron = [...pool].sort(
    (a, b) => new Date(a.closed_at ?? 0).getTime() - new Date(b.closed_at ?? 0).getTime(),
  )
  for (let i = 1; i < chron.length; i++) {
    const prev = chron[i - 1]
    const curr = chron[i]
    if ((prev.realized_pnl ?? 0) < 0 && curr.strategy_id !== prev.strategy_id) hops++
  }
  const hoppingDiagnosis =
    chron.length < 2
      ? 'Data belum cukup untuk menilai strategy hopping.'
      : hops === 0
        ? 'Tidak terdeteksi strategy hopping — kamu bertahan pada strategi yang sama meski mengalami loss. Pertahankan.'
        : `Terdeteksi ${hops}x indikasi strategy hopping (ganti strategi tepat setelah loss). Selesaikan dulu kuota sampel sebelum menilai strategi.`

  const leak = leakSummary(entries)
  const stats = strategies
    .map((s) => strategyStats(s.id, s.name, s.status, s.target_sample_size, entries))
    .filter((s) => s.closedCount > 0)
    .sort((a, b) => b.expectancy - a.expectancy)
  const best = stats[0]
  const worst = stats[stats.length - 1]

  let coachTip: string
  if (leak.leakTotal < 0) {
    coachTip = `Prioritas besok: nol-kan trade ${leak.offenders[0]?.emotion ?? 'emosional'}. Tanpa trade emosional, P/L portofolio jadi ${money(leak.cleanNetPnl, 'IDR', { sign: true })} (sekarang ${money(leak.actualNetPnl, 'IDR', { sign: true })}).`
  } else if (best && worst && best.strategyId !== worst.strategyId && worst.expectancy < 0) {
    coachTip = `Alokasikan lebih banyak eksekusi ke "${best.name}" (expectancy ${money(best.expectancy)}/trade) dan hentikan sementara "${worst.name}" yang masih negatif.`
  } else if (best) {
    coachTip = `Tetap fokus pada "${best.name}". Hindari entry bila Planned R:R di bawah 1:1.5.`
  } else {
    coachTip = 'Definisikan minimal satu strategi di Playbook dan kejar kuota 20 trade sebelum menilai hasil.'
  }

  return {
    generatedAt: ref.toISOString(),
    scope,
    statusToday,
    disciplineDiagnosis,
    hoppingDiagnosis,
    coachTip,
    metrics: [
      { label: 'Discipline Score', value: `${disc.score}%` },
      { label: 'Emotional Leak (net)', value: money(leak.leakTotal, 'IDR', { sign: true }) },
      { label: 'Strategi terbaik', value: best ? best.name : '—' },
      { label: 'Trade dianalisa', value: String(pool.length) },
    ],
  }
}

// ---------------------------------------------------------------------------
// Weekly Review (Roadmap V2 A4) — deterministic prose over the last N days.
// The AI path (engine.ts) may replace `summary`; everything else stays derived.
// ---------------------------------------------------------------------------

export interface WeeklyReview {
  rangeLabel: string
  trades: number
  summary: string
  wins: string[] // what went well
  watch: string[] // what to watch
  actions: string[] // concrete next steps
}

export function buildWeeklyReview(
  entries: JournalEntry[],
  strategies: Strategy[],
  now = new Date(),
  days = 7,
): WeeklyReview {
  const since = new Date(now.getTime() - days * 86400000)
  const inRange = entries.filter((e) => new Date(e.entry_at) >= since)
  const closed = inRange.filter((e) => e.status === 'closed')
  const net = closed.reduce((s, e) => s + toIDR(e.realized_pnl, e.size_currency), 0)
  const wins = closed.filter((e) => (e.realized_pnl ?? 0) > 0).length
  const rangeLabel = `${since.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} – ${now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`

  const disc = disciplineSummary(inRange)
  const leak = leakSummary(inRange)
  const flags = behaviorFlags(inRange)
  const revenge = flags.filter((f) => f.kind === 'revenge').length
  const insights = autoInsights(entries, strategies)
  const sess = bySession(entries).filter((b) => b.trades >= 2)
  const bestSess = [...sess].sort((a, b) => b.expectancy - a.expectancy)[0]

  const summary = closed.length
    ? `Minggu ini ${closed.length} trade ditutup (${wins} Win, ${closed.length - wins} Lose), net ${money(net, 'IDR', { sign: true })}. Discipline score ${disc.score}%.`
    : `Belum ada trade yang ditutup dalam ${days} hari terakhir.`

  const good: string[] = []
  if (disc.score >= 75) good.push(`Kepatuhan SOP kuat (${disc.cleanTrades}/${disc.totalClosed} trade bersih).`)
  const edge = insights.find((i) => i.kind === 'edge')
  if (edge) good.push(edge.detail)
  if (bestSess) good.push(`Performa terbaik di sesi ${bestSess.key} (expectancy ${money(bestSess.expectancy, 'IDR', { sign: true })}/trade).`)
  if (!good.length) good.push('Belum ada pola positif yang menonjol — kumpulkan lebih banyak sampel.')

  const watch: string[] = []
  if (revenge) watch.push(`${revenge} entri terdeteksi revenge trading (masuk cepat setelah loss, size/risk naik).`)
  if (leak.leakTotal < 0) watch.push(`Kebocoran emosi ${money(leak.leakTotal, 'IDR', { sign: true })} dari trade ${leak.offenders[0]?.emotion ?? 'emosional'}.`)
  const weak = insights.find((i) => i.kind === 'weakness')
  if (weak) watch.push(weak.detail)
  const timeIns = insights.find((i) => i.kind === 'time')
  if (timeIns) watch.push(timeIns.detail)
  if (!watch.length) watch.push('Tidak ada kebocoran perilaku yang mencolok minggu ini.')

  const actions: string[] = []
  if (revenge || leak.leakTotal < 0)
    actions.push('Setelah 2 loss beruntun: stop 30 menit, kembali hanya untuk setup A+.')
  const riskIns = insights.find((i) => i.kind === 'risk')
  if (riskIns) actions.push('Kunci risk maksimal 2% per trade — jangan naikkan saat streak.')
  if (weak) actions.push(`Kurangi eksekusi ${weak.title.replace('Kelemahan: ', '')} sampai ada sampel valid pada strategi utama.`)
  if (!actions.length) actions.push('Pertahankan ritme. Fokus menyelesaikan kuota sampel strategi utama.')

  return { rangeLabel, trades: closed.length, summary, wins: good, watch, actions }
}
