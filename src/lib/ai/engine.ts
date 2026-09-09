// Pluggable daily-insight engine.
//
//  • If VITE_ANTHROPIC_API_KEY is set  -> real batched Claude call (DEV ONLY —
//    the key is exposed to the browser; production MUST run this from the
//    Supabase Edge Function `ai-daily`, see /supabase/functions).
//  • Otherwise -> deterministic briefing derived from the data (cost $0, offline).
//
// Both paths return the same shape so the dashboard widget doesn't care which ran.
import type { JournalEntry, Strategy } from '../../types'
import { buildBriefing, type Briefing } from '../ai'
import { INSIGHT_SYSTEM, buildInsightUserPrompt, type InsightJson } from './prompt'

export type BriefingSource = 'claude-api' | 'deterministic'

export interface BriefingResult extends Briefing {
  source: BriefingSource
  analyzedTradeIds: string[]
  aiJson?: InsightJson
  error?: string
}

const MODEL = 'claude-sonnet-5'
const API = 'https://api.anthropic.com/v1/messages'

function unanalyzedClosed(journal: JournalEntry[]): JournalEntry[] {
  return journal.filter((t) => t.status === 'closed' && !t.analyzed_by_ai)
}

export async function generateBriefing(
  journal: JournalEntry[],
  strategies: Strategy[],
): Promise<BriefingResult> {
  const base = buildBriefing(journal, strategies)
  const pool = unanalyzedClosed(journal)
  const ids = pool.map((t) => t.id)

  const key = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined
  if (!key || pool.length === 0) {
    return { ...base, source: 'deterministic', analyzedTradeIds: ids }
  }

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: INSIGHT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: buildInsightUserPrompt(pool, strategies, new Date().toISOString().slice(0, 10)),
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const data = await res.json()
    const text: string = data?.content?.[0]?.text ?? ''
    const json = JSON.parse(text.replace(/^```(?:json)?|```$/g, '').trim()) as InsightJson

    return {
      ...base,
      source: 'claude-api',
      analyzedTradeIds: ids,
      aiJson: json,
      statusToday: json.executive_summary || base.statusToday,
      disciplineDiagnosis: json.discipline_diagnosis || base.disciplineDiagnosis,
      hoppingDiagnosis: json.hopping_diagnosis || base.hoppingDiagnosis,
      coachTip: json.actionable_coach_tip || base.coachTip,
    }
  } catch (e) {
    return {
      ...base,
      source: 'deterministic',
      analyzedTradeIds: ids,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
