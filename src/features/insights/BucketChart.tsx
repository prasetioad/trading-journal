import type { Bucket } from '../../lib/analytics'
import { money } from '../../lib/format'

/** Vertical bars of expectancy (or net P/L) per bucket, signed green/red. */
export function BucketChart({
  rows,
  metric = 'expectancy',
  emptyHint,
}: {
  rows: Bucket[]
  metric?: 'expectancy' | 'netPnl'
  emptyHint?: string
}) {
  if (rows.length === 0)
    return <p className="py-6 text-center text-xs text-ink-mute">{emptyHint ?? 'Belum ada data.'}</p>

  const vals = rows.map((r) => r[metric])
  const max = Math.max(1, ...vals.map((v) => Math.abs(v)))

  return (
    <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 132 }}>
      {rows.map((r) => {
        const v = r[metric]
        const h = (Math.abs(v) / max) * 92
        const pos = v >= 0
        return (
          <div key={r.key} className="flex min-w-[44px] flex-1 flex-col items-center gap-1">
            <div className="flex h-[104px] w-full flex-col justify-end">
              <div
                className={`mx-auto w-6 rounded-t ${pos ? 'bg-win/70' : 'bg-lose/70'}`}
                style={{ height: Math.max(3, h) }}
                title={`${r.key}: ${money(v, 'IDR', { sign: true })} · ${r.trades} trade · WR ${(r.winRate * 100).toFixed(0)}%`}
              />
            </div>
            <div className="text-center">
              <div className="text-[10px] font-semibold text-ink-soft">{r.key}</div>
              <div className="tnum text-[9px] text-ink-mute">{r.trades}t</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
