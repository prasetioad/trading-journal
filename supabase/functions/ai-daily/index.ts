// Edge Function: AI Daily Insight batch (PRD §4.5).
// Invoked by pg_cron at 17:00 WIB (10:00 UTC) — see migrations/0002_cron.sql.
//
// Per user with >=1 closed trade where analyzed_by_ai = false:
//   1. build ONE batched prompt
//   2. call Anthropic once
//   3. upsert journal_daily_insights, insert journal_reason_tags
//   4. flag those trades analyzed_by_ai = true
// If a user has no new closed trades -> skipped -> $0.
//
// Deploy:  supabase functions deploy ai-daily --no-verify-jwt
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = 'claude-sonnet-5'

const SYSTEM = `Kamu adalah "AI Executive Trading Coach". Diagnosis jurnal trading harian trader ritel:
kepatuhan SOP & strategy hopping, ekstraksi tag teknikal dari reasoning, audit emosi->hasil, 1 saran konkret.
Ringkas, tegas, berbasis angka, Bahasa Indonesia. Balas HANYA JSON valid tanpa markdown fence.`

function userPrompt(trades: any[], strategies: any[], date: string) {
  const sName = new Map(strategies.map((s) => [s.id, s.name]))
  const rows = trades.map((t, i) =>
    [
      `#${i + 1} ref=${t.id}`,
      `pair=${t.pair}`,
      `strategi=${t.strategy_id ? sName.get(t.strategy_id) ?? 'dihapus' : 'TANPA_STRATEGI'}`,
      `sesuai_rencana=${t.followed_plan ? 'ya' : 'TIDAK'}`,
      `psikologi=${t.psychology}`,
      `realized_rr=${t.realized_rr ?? 'n/a'}`,
      `realized_pnl=${t.realized_pnl ?? 'n/a'} ${t.size_currency}`,
      `outcome=${t.outcome ?? 'n/a'}`,
      `alasan="${String(t.reasoning ?? '').replace(/\s+/g, ' ').trim()}"`,
    ].join(' | '),
  )
  return `Tanggal: ${date}
Trade closed belum dianalisa: ${trades.length}

DATA:
${rows.join('\n')}

STRATEGI:
${strategies.map((s) => `- ${s.name} [${s.status}] target ${s.target_sample_size}`).join('\n') || '- (kosong)'}

Balas HANYA JSON:
{
  "executive_summary": string,
  "discipline_diagnosis": string,
  "hopping_diagnosis": string,
  "actionable_coach_tip": string,
  "discipline_score": number,           // 0..100
  "emotional_leak_total": number,       // nominal (base currency user), boleh negatif
  "reason_tags": [ { "journal_ref": string, "tag": string, "confidence": number } ],
  "psychology_audit": [ { "emotion": string, "verdict": "profit-catalyst"|"capital-destroyer"|"neutral", "note": string } ]
}`
}

async function callClaude(system: string, prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text = data?.content?.[0]?.text ?? '{}'
  return JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim())
}

Deno.serve(async () => {
  const today = new Date().toISOString().slice(0, 10)

  const { data: pending = [] } = await admin
    .from('journal_entries')
    .select('*')
    .eq('status', 'closed')
    .eq('analyzed_by_ai', false)

  const byUser = new Map<string, any[]>()
  for (const t of pending as any[]) {
    const arr = byUser.get(t.user_id) ?? []
    arr.push(t)
    byUser.set(t.user_id, arr)
  }

  const summary: Record<string, unknown>[] = []

  for (const [userId, trades] of byUser) {
    const { data: strategies = [] } = await admin
      .from('user_strategies')
      .select('*')
      .eq('user_id', userId)

    let json: any
    try {
      json = await callClaude(SYSTEM, userPrompt(trades, strategies as any[], today))
    } catch (e) {
      summary.push({ userId, error: String(e) })
      continue
    }

    await admin.from('journal_daily_insights').upsert(
      {
        user_id: userId,
        insight_date: today,
        total_trades_analyzed: trades.length,
        discipline_score: json.discipline_score ?? null,
        emotional_leak_total: json.emotional_leak_total ?? null,
        executive_summary: json.executive_summary ?? '',
        actionable_coach_tip: json.actionable_coach_tip ?? null,
        metrics_breakdown: json,
      },
      { onConflict: 'user_id,insight_date' },
    )

    if (Array.isArray(json.reason_tags) && json.reason_tags.length) {
      await admin.from('journal_reason_tags').insert(
        json.reason_tags.map((r: any) => ({
          journal_id: r.journal_ref,
          user_id: userId,
          tag: r.tag,
          confidence: r.confidence ?? null,
        })),
      )
    }

    await admin
      .from('journal_entries')
      .update({ analyzed_by_ai: true, analyzed_at: new Date().toISOString() })
      .in(
        'id',
        trades.map((t) => t.id),
      )

    summary.push({ userId, trades: trades.length, ok: true })
  }

  return Response.json({ ok: true, date: today, users: summary })
})
