import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { drawdown, streaks } from '../../lib/analytics'
import { money } from '../../lib/format'
import { Card, EmptyState, SectionTitle, StatTile } from '../../components/ui/primitives'

export function StreakDrawdown() {
  const { journal } = useStore()
  const { s, dd } = useMemo(
    () => ({ s: streaks(journal), dd: drawdown(journal) }),
    [journal],
  )

  const pts = dd.points
  const spark = useMemo(() => {
    if (pts.length < 2) return null
    const W = 320
    const H = 56
    const ys = pts.map((p) => p.ddAbs) // <= 0
    const min = Math.min(...ys, 0)
    const x = (i: number) => (i / (pts.length - 1)) * W
    const y = (v: number) => (min === 0 ? H : H - (v / min) * H)
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.ddAbs).toFixed(1)}`).join(' ')
    return { W, H, line, area: `${line} L${W},${H} L0,${H} Z` }
  }, [pts])

  const cur = s.current
  const curLabel = cur === 0 ? '—' : `${cur > 0 ? '+' : ''}${cur}`

  return (
    <Card>
      <SectionTitle title="Streak & Drawdown" hint="Runtun hasil dan penurunan ekuitas dari puncak." />
      {pts.length === 0 ? (
        <EmptyState title="Butuh trade closed." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Current streak"
              value={curLabel}
              tone={cur > 0 ? 'win' : cur < 0 ? 'lose' : 'neutral'}
            />
            <StatTile label="Best win streak" value={`+${s.bestWin}`} tone="win" />
            <StatTile label="Worst loss streak" value={String(s.worstLoss)} tone="lose" />
            <StatTile
              label="Max drawdown"
              value={money(dd.maxDrawdownAbs, 'IDR', { sign: true })}
              tone="lose"
            />
            <StatTile
              label="Max DD %"
              value={dd.maxDrawdownPct ? `${(dd.maxDrawdownPct * 100).toFixed(1)}%` : '0%'}
              tone="lose"
            />
            <StatTile
              label="Recovery"
              value={money(dd.recovery, 'IDR', { sign: true })}
              tone={dd.recovery >= 0 ? 'win' : 'lose'}
            />
          </div>

          {spark && (
            <div className="mt-3 overflow-x-auto">
              <svg viewBox={`0 0 ${spark.W} ${spark.H}`} className="w-full min-w-[280px]" preserveAspectRatio="none">
                <path d={spark.area} fill="var(--color-lose)" fillOpacity="0.14" />
                <path d={spark.line} fill="none" stroke="var(--color-lose)" strokeWidth="1.5" />
              </svg>
              <div className="text-[10px] text-ink-mute">Underwater curve (jarak dari puncak ekuitas)</div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
