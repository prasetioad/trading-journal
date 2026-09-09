import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/store'
import { generateBriefing, type BriefingResult } from '../../lib/ai/engine'
import { dateTime } from '../../lib/format'
import { Badge } from '../../components/ui/primitives'

const CACHE_KEY = 'tj.briefing.v1'

function loadCache(): BriefingResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as BriefingResult) : null
  } catch {
    return null
  }
}

export function ExecutiveBriefing() {
  const { journal, strategies, markAnalyzed } = useStore()
  const [result, setResult] = useState<BriefingResult | null>(() => loadCache())
  const [loading, setLoading] = useState(false)
  const ranOnce = useRef(false)

  const run = useCallback(
    async (markTrades: boolean) => {
      setLoading(true)
      try {
        const r = await generateBriefing(journal, strategies)
        setResult(r)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(r))
        } catch {
          /* ignore */
        }
        if (markTrades && r.analyzedTradeIds.length) markAnalyzed(r.analyzedTradeIds)
      } finally {
        setLoading(false)
      }
    },
    [journal, strategies, markAnalyzed],
  )

  // first paint: if nothing cached, compute once (deterministic, no marking)
  const runRef = useRef(run)
  runRef.current = run
  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true
    if (!loadCache()) void runRef.current(false)
  }, [])

  const b = result

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-gradient-to-r from-brand/10 to-transparent px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-brand-dim text-[11px] font-black text-[#04120c]">
            AI
          </span>
          <h2 className="text-sm font-semibold text-ink">AI Executive Coach Briefing</h2>
          {b && <Badge tone="violet">{b.scope}</Badge>}
          {b && (
            <Badge tone={b.source === 'claude-api' ? 'brand' : 'neutral'}>
              {b.source === 'claude-api' ? 'Claude API' : 'deterministik'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {b && <span className="text-[11px] text-ink-mute">{dateTime(b.generatedAt)}</span>}
          <button className="btn btn-ghost px-2.5 py-1 text-xs" disabled={loading} onClick={() => run(true)}>
            {loading ? 'Menganalisa…' : 'Regenerate'}
          </button>
        </div>
      </div>

      {!b ? (
        <div className="px-5 py-8 text-center text-sm text-ink-mute">Menyiapkan briefing…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-3">
            <Block label="Status" text={b.statusToday} />
            <Block
              label="Discipline & Hopping"
              text={`${b.disciplineDiagnosis} ${b.hoppingDiagnosis}`}
            />
            <Block label="Pesan Coach untuk besok" text={b.coachTip} accent />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border-soft px-5 py-3">
            {b.metrics.map((m) => (
              <div key={m.label} className="text-xs">
                <span className="text-ink-mute">{m.label}: </span>
                <span className="tnum font-semibold text-ink">{m.value}</span>
              </div>
            ))}
          </div>

          {b.aiJson?.psychology_audit?.length ? (
            <div className="flex flex-wrap gap-2 border-t border-border-soft px-5 py-3">
              {b.aiJson.psychology_audit.map((p) => (
                <Badge
                  key={p.emotion}
                  tone={
                    p.verdict === 'profit-catalyst'
                      ? 'win'
                      : p.verdict === 'capital-destroyer'
                        ? 'lose'
                        : 'neutral'
                  }
                >
                  {p.emotion}: {p.verdict}
                </Badge>
              ))}
            </div>
          ) : null}

          <p className="border-t border-border-soft px-5 py-2 text-[10px] text-ink-mute">
            {b.source === 'claude-api'
              ? 'Dihasilkan oleh Claude (1 batch call). Di produksi panggilan ini dijalankan Edge Function 17:00 WIB, bukan browser.'
              : b.error
                ? `Fallback deterministik (Claude gagal: ${b.error}).`
                : 'Dihasilkan deterministik dari data jurnal (biaya $0). Set VITE_ANTHROPIC_API_KEY untuk memakai Claude.'}
          </p>
        </>
      )}
    </div>
  )
}

function Block({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${accent ? 'border-brand/30 bg-brand/8' : 'border-border-soft bg-surface-2/50'}`}
    >
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</div>
      <p className="text-[13px] leading-relaxed text-ink-soft">{text}</p>
    </div>
  )
}
