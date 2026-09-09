import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { rrGapRows } from '../../lib/finance'
import { num, rr } from '../../lib/format'
import { Card, EmptyState, SectionTitle } from '../../components/ui/primitives'

export function RRGapChart() {
  const { journal } = useStore()
  const rows = useMemo(() => rrGapRows(journal).slice(0, 12), [journal])

  const avgPlanned = rows.length ? rows.reduce((s, r) => s + r.planned, 0) / rows.length : 0
  const avgRealized = rows.length ? rows.reduce((s, r) => s + r.realized, 0) / rows.length : 0
  const earlyExits = rows.filter((r) => r.gap > 0.3).length

  const maxPos = Math.max(1, ...rows.flatMap((r) => [r.planned, Math.max(0, r.realized)]))
  const maxNeg = Math.max(0, ...rows.map((r) => Math.max(0, -r.realized)))
  const barW = 22
  const innerGap = 3 // between the two bars of one trade
  const slot = barW * 2 + innerGap + 20 // per-trade column
  const padL = 12
  const chartW = Math.max(rows.length * slot + padL + 12, 320)
  const posH = 128 // px available above the zero line
  const negH = maxNeg > 0 ? 34 : 0 // px available below the zero line
  const zeroY = 12 + posH
  const chartH = zeroY + negH + 20 // + room for labels
  const scalePos = (v: number) => (v / maxPos) * posH
  const scaleNeg = (v: number) => (maxNeg ? (v / maxNeg) * negH : 0)

  return (
    <Card>
      <SectionTitle
        title="R:R Execution Inefficiency Gap"
        hint="Planned vs Realized R:R per trade — deteksi cut profit terlalu dini."
      />

      {rows.length === 0 ? (
        <EmptyState title="Belum ada trade closed dengan Realized R:R." />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
            <span className="text-ink-soft">
              Avg Planned: <span className="tnum font-semibold text-info">{rr(avgPlanned)}</span>
            </span>
            <span className="text-ink-soft">
              Avg Realized:{' '}
              <span className={`tnum font-semibold ${avgRealized < avgPlanned * 0.8 ? 'text-warn' : 'text-brand'}`}>
                {rr(avgRealized)}
              </span>
            </span>
            <span className="text-ink-soft">
              Early exits (gap &gt; 0.3):{' '}
              <span className="tnum font-semibold text-warn">{earlyExits}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <svg width={chartW} height={chartH} className="block">
              <line
                x1={padL}
                y1={zeroY}
                x2={chartW - 8}
                y2={zeroY}
                stroke="var(--color-border)"
              />
              {rows.map((r, i) => {
                const x = padL + 8 + i * slot
                const realNeg = r.realized < 0
                const rH = realNeg ? scaleNeg(-r.realized) : scalePos(r.realized)
                const mid = x + barW + innerGap / 2
                return (
                  <g key={r.id}>
                    {/* planned */}
                    <rect
                      x={x}
                      y={zeroY - scalePos(r.planned)}
                      width={barW}
                      height={scalePos(r.planned)}
                      rx={3}
                      fill="var(--color-info)"
                      opacity={0.5}
                    />
                    {/* realized */}
                    <rect
                      x={x + barW + innerGap}
                      y={realNeg ? zeroY : zeroY - rH}
                      width={barW}
                      height={rH}
                      rx={3}
                      fill={realNeg ? 'var(--color-lose)' : 'var(--color-brand)'}
                    />
                    <text
                      x={mid}
                      y={chartH - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--color-ink-mute)"
                    >
                      {r.pair.replace('USDT', '')}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="mt-2 flex gap-4 text-[11px] text-ink-mute">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-info/60" /> Planned R:R
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" /> Realized R:R
            </span>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
            {avgRealized < avgPlanned * 0.8
              ? `Realized R:R rata-rata hanya ${num((avgRealized / (avgPlanned || 1)) * 100, 0)}% dari rencana — indikasi sering menutup profit terlalu cepat.`
              : 'Realisasi R:R relatif konsisten dengan rencana. Bagus.'}
          </p>
        </>
      )}
    </Card>
  )
}
