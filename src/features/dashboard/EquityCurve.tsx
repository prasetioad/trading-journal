import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { equityCurve } from '../../lib/finance'
import { money } from '../../lib/format'
import { Card, EmptyState, SectionTitle } from '../../components/ui/primitives'

export function EquityCurve() {
  const { journal } = useStore()
  const pts = useMemo(() => equityCurve(journal), [journal])

  const W = 640
  const H = 200
  const padX = 8
  const padY = 16

  const geom = useMemo(() => {
    if (pts.length < 2) return null
    const xs = pts.map((_, i) => i)
    const ys = pts.map((p) => p.cum)
    const minY = Math.min(0, ...ys)
    const maxY = Math.max(0, ...ys)
    const spanY = maxY - minY || 1
    const x = (i: number) => padX + (i / (xs.length - 1)) * (W - padX * 2)
    const y = (v: number) => padY + (1 - (v - minY) / spanY) * (H - padY * 2)
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join(' ')
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${y(minY).toFixed(1)} L${x(0).toFixed(1)},${y(minY).toFixed(1)} Z`
    return { x, y, line, area, zeroY: y(0), last: pts[pts.length - 1].cum }
  }, [pts])

  return (
    <Card>
      <SectionTitle title="Equity Curve" hint="Akumulasi Realized P/L (IDR) sepanjang waktu." />
      {!geom ? (
        <EmptyState title="Butuh minimal 2 trade closed." />
      ) : (
        <>
          <div className="mb-2 text-xs text-ink-soft">
            Net akumulasi:{' '}
            <span className={`tnum font-semibold ${geom.last >= 0 ? 'text-win' : 'text-lose'}`}>
              {money(geom.last, 'IDR', { sign: true })}
            </span>{' '}
            · {pts.length} trade
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]" preserveAspectRatio="none">
              <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1={padX} y1={geom.zeroY} x2={W - padX} y2={geom.zeroY} stroke="var(--color-border)" strokeDasharray="3 3" />
              <path d={geom.area} fill="url(#eq)" />
              <path d={geom.line} fill="none" stroke="var(--color-brand)" strokeWidth="2" />
              {pts.map((p, i) => (
                <circle
                  key={i}
                  cx={geom.x(i)}
                  cy={geom.y(p.cum)}
                  r={2.2}
                  fill={p.pnl >= 0 ? 'var(--color-win)' : 'var(--color-lose)'}
                />
              ))}
            </svg>
          </div>
        </>
      )}
    </Card>
  )
}
