// Deterministic stand-in for the AI Daily Insight Engine (PRD §4.5).
// In production this text comes from a batched Claude call at 17:00 WIB; the
// prototype derives an equivalent briefing straight from the journal data so the
// dashboard widget is fully wired.
import type { JournalEntry, Strategy } from '../types'
import { DESTRUCTIVE_EMOTIONS } from '../types'
import { disciplineSummary, leakSummary, strategyStats } from './finance'
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
