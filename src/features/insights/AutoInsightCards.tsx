import type { Insight, InsightKind } from '../../lib/rules'
import { EmptyState } from '../../components/ui/primitives'

const META: Record<InsightKind, { icon: string; ring: string; tag: string }> = {
  edge: { icon: '🔥', ring: 'border-win/30 bg-win/5', tag: 'Your Edge' },
  weakness: { icon: '⚠️', ring: 'border-lose/30 bg-lose/5', tag: 'Your Weakness' },
  behavioral: { icon: '🧠', ring: 'border-violet/30 bg-violet/5', tag: 'Behavioral' },
  time: { icon: '⏰', ring: 'border-info/30 bg-info/5', tag: 'Time Pattern' },
  risk: { icon: '💰', ring: 'border-warn/30 bg-warn/5', tag: 'Risk Pattern' },
}

export function AutoInsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0)
    return (
      <EmptyState
        title="Belum cukup data untuk insight otomatis."
        hint="Butuh minimal 3 trade closed dengan setup tag / market condition."
      />
    )
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {insights.map((i, idx) => {
        const m = META[i.kind]
        return (
          <div key={idx} className={`rounded-xl border p-4 ${m.ring}`}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-base">{m.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-mute">
                {m.tag}
              </span>
            </div>
            <div className="text-sm font-semibold text-ink">{i.title}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{i.detail}</p>
          </div>
        )
      })}
    </div>
  )
}
