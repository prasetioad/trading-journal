// Batched daily-insight prompt (PRD §4.5). One call per user per day.
// This exact builder is meant to be shared with the Supabase Edge Function
// `ai-daily` — keep it dependency-free.
import type { JournalEntry, Strategy } from '../../types'
import { plannedRR } from '../finance'

export interface InsightJson {
  executive_summary: string
  discipline_diagnosis: string
  hopping_diagnosis: string
  actionable_coach_tip: string
  reason_tags: { journal_ref: string; tag: string; confidence: number }[]
  psychology_audit: { emotion: string; verdict: 'profit-catalyst' | 'capital-destroyer' | 'neutral'; note: string }[]
}

export const INSIGHT_SYSTEM = `Kamu adalah "AI Executive Trading Coach". Tugasmu mendiagnosis jurnal trading harian seorang trader ritel.
Fokus:
1. Kepatuhan SOP & deteksi "strategy hopping" (ganti strategi impulsif setelah loss).
2. Ekstraksi pola teknikal dari kolom reasoning bebas menjadi tag pendek.
3. Audit hubungan emosi -> hasil (emosi mana katalis profit, mana penghancur modal).
4. Satu saran konkret untuk sesi berikutnya.
Gaya: ringkas, tegas, berbasis angka, Bahasa Indonesia. Jangan memberi nasihat finansial umum.
WAJIB membalas HANYA JSON valid sesuai skema yang diminta, tanpa markdown fence.`

export function buildInsightUserPrompt(
  trades: JournalEntry[],
  strategies: Strategy[],
  dateLabel: string,
): string {
  const sName = new Map(strategies.map((s) => [s.id, s.name]))
  const lines = trades.map((t, i) => {
    const prr = plannedRR(t.entry_price, t.take_profit, t.stop_loss)
    return [
      `#${i + 1} ref=${t.id}`,
      `pair=${t.pair}`,
      `strategi=${t.strategy_id ? sName.get(t.strategy_id) ?? 'dihapus' : 'TANPA_STRATEGI'}`,
      `arah=${t.direction}`,
      `sesuai_rencana=${t.followed_plan ? 'ya' : 'TIDAK'}`,
      `psikologi=${t.psychology}`,
      `planned_rr=${prr ?? 'n/a'}`,
      `realized_rr=${t.realized_rr ?? 'n/a'}`,
      `realized_pnl=${t.realized_pnl ?? 'n/a'} ${t.size_currency}`,
      `outcome=${t.outcome ?? 'n/a'}`,
      `alasan="${t.reasoning.replace(/\s+/g, ' ').trim()}"`,
    ].join(' | ')
  })

  return `Tanggal evaluasi: ${dateLabel}
Jumlah trade closed yang belum dianalisa: ${trades.length}

DATA TRADE:
${lines.join('\n')}

STRATEGI DI PLAYBOOK:
${strategies.map((s) => `- ${s.name} [${s.status}] target ${s.target_sample_size} trade`).join('\n') || '- (kosong)'}

Balas HANYA JSON dengan bentuk:
{
  "executive_summary": string,           // 1-2 kalimat status hari ini + net P/L
  "discipline_diagnosis": string,        // kepatuhan SOP hari ini
  "hopping_diagnosis": string,           // ada/tidak strategy hopping + bukti
  "actionable_coach_tip": string,        // 1 saran konkret untuk besok
  "reason_tags": [ { "journal_ref": string, "tag": string, "confidence": number } ],
  "psychology_audit": [ { "emotion": string, "verdict": "profit-catalyst"|"capital-destroyer"|"neutral", "note": string } ]
}`
}
