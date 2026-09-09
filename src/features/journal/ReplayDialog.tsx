import { useEffect, useMemo, useRef, useState } from 'react'
import type { JournalEntry } from '../../types'
import { fetchKlines, type Candle, type KlineInterval } from '../../lib/binance'
import { isCryptoPair } from '../../lib/verify'
import { num, rr } from '../../lib/format'
import { Badge } from '../../components/ui/primitives'

function pickInterval(spanMs: number): KlineInterval {
  const h = spanMs / 3_600_000
  if (h <= 72) return '15m'
  if (h <= 480) return '1h'
  if (h <= 2400) return '4h'
  return '1d'
}

export function ReplayDialog({ trade }: { trade: JournalEntry }) {
  const [candles, setCandles] = useState<Candle[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [reveal, setReveal] = useState(1)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const entryMs = new Date(trade.entry_at).getTime()
  const exitMs = trade.closed_at ? new Date(trade.closed_at).getTime() : Date.now()

  useEffect(() => {
    if (!isCryptoPair(trade.pair)) return
    const pad = 24 * 3_600_000
    const start = entryMs - pad * 2
    const end = exitMs + pad
    fetchKlines(trade.pair, pickInterval(end - start), start, end)
      .then((c) => {
        setCandles(c)
        setReveal(Math.max(1, Math.floor(c.length * 0.35)))
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Gagal memuat candle'))
  }, [trade.id, trade.pair, entryMs, exitMs])

  useEffect(() => {
    if (!playing || !candles) return
    timer.current = setInterval(() => {
      setReveal((r) => {
        if (r >= candles.length) {
          setPlaying(false)
          return r
        }
        return r + 1
      })
    }, 120)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [playing, candles])

  const geom = useMemo(() => {
    if (!candles || candles.length < 2) return null
    const W = 640
    const H = 260
    const shown = candles.slice(0, reveal)
    const all = candles // keep axis stable across playback
    const lo = Math.min(...all.map((c) => c.l), trade.stop_loss, trade.take_profit, trade.entry_price)
    const hi = Math.max(...all.map((c) => c.h), trade.stop_loss, trade.take_profit, trade.entry_price)
    const span = hi - lo || 1
    const x = (i: number) => 6 + (i / (all.length - 1)) * (W - 12)
    const y = (v: number) => 8 + (1 - (v - lo) / span) * (H - 16)
    const bw = Math.max(1.5, (W - 12) / all.length - 1.5)
    const entryIdx = nearestIdx(all, entryMs)
    const exitIdx = trade.closed_at ? nearestIdx(all, exitMs) : null
    return { W, H, shown, x, y, bw, entryIdx, exitIdx, yE: y(trade.entry_price), yT: y(trade.take_profit), yS: y(trade.stop_loss) }
  }, [candles, reveal, trade, entryMs, exitMs])

  if (!isCryptoPair(trade.pair)) {
    return (
      <p className="py-8 text-center text-sm text-ink-mute">
        Replay memerlukan data OHLC. Tersedia untuk pair crypto (Binance); untuk saham IDX butuh
        provider data historis.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-ink">{trade.pair}</span>
        <Badge tone={trade.direction === 'long' ? 'brand' : 'lose'}>{trade.direction}</Badge>
        <span className="text-ink-mute">
          Entry <span className="tnum">{num(trade.entry_price, 8)}</span> · TP{' '}
          <span className="tnum text-win">{num(trade.take_profit, 8)}</span> · SL{' '}
          <span className="tnum text-lose">{num(trade.stop_loss, 8)}</span>
        </span>
        {trade.status === 'closed' && (
          <Badge tone={trade.outcome === 'win' ? 'win' : trade.outcome === 'lose' ? 'lose' : 'neutral'}>
            {trade.outcome} · R {rr(trade.realized_rr)}
          </Badge>
        )}
      </div>

      {err && <p className="text-xs text-lose">{err}</p>}
      {!candles && !err && <p className="py-10 text-center text-xs text-ink-mute">Memuat candle…</p>}

      {geom && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface-2/40">
            <svg viewBox={`0 0 ${geom.W} ${geom.H}`} className="w-full min-w-[460px]">
              {/* levels */}
              <line x1={0} x2={geom.W} y1={geom.yT} y2={geom.yT} stroke="var(--color-win)" strokeDasharray="4 3" strokeOpacity="0.7" />
              <line x1={0} x2={geom.W} y1={geom.yS} y2={geom.yS} stroke="var(--color-lose)" strokeDasharray="4 3" strokeOpacity="0.7" />
              <line x1={0} x2={geom.W} y1={geom.yE} y2={geom.yE} stroke="var(--color-ink-soft)" strokeDasharray="2 2" strokeOpacity="0.6" />
              {/* candles */}
              {geom.shown.map((c, i) => {
                const up = c.c >= c.o
                const col = up ? 'var(--color-win)' : 'var(--color-lose)'
                const cx = geom.x(i)
                return (
                  <g key={c.t}>
                    <line x1={cx} x2={cx} y1={geom.y(c.h)} y2={geom.y(c.l)} stroke={col} strokeWidth="1" />
                    <rect
                      x={cx - geom.bw / 2}
                      y={Math.min(geom.y(c.o), geom.y(c.c))}
                      width={geom.bw}
                      height={Math.max(1, Math.abs(geom.y(c.o) - geom.y(c.c)))}
                      fill={col}
                    />
                  </g>
                )
              })}
              {/* entry / exit markers (only once revealed) */}
              {geom.entryIdx < reveal && (
                <circle cx={geom.x(geom.entryIdx)} cy={geom.yE} r="4" fill="var(--color-ink)" stroke="var(--color-bg)" />
              )}
              {geom.exitIdx != null && geom.exitIdx < reveal && (
                <circle
                  cx={geom.x(geom.exitIdx)}
                  cy={geom.y(trade.exit_price ?? trade.entry_price)}
                  r="4"
                  fill={trade.outcome === 'win' ? 'var(--color-win)' : 'var(--color-lose)'}
                  stroke="var(--color-bg)"
                />
              )}
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => setPlaying((p) => !p)}>
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <input
              type="range"
              min={1}
              max={candles!.length}
              value={reveal}
              onChange={(e) => {
                setPlaying(false)
                setReveal(Number(e.target.value))
              }}
              className="flex-1 accent-[var(--color-brand)]"
            />
            <span className="tnum w-16 text-right text-[11px] text-ink-mute">
              {reveal}/{candles!.length}
            </span>
          </div>
          <p className="text-[11px] text-ink-mute">
            Geser untuk memutar ulang: “kalau saya lihat chart ini {reveal < (geom.entryIdx ?? 0) ? 'sebelum' : 'saat'} entry, apakah saya tetap masuk?”
          </p>
        </>
      )}
    </div>
  )
}

function nearestIdx(candles: Candle[], ms: number): number {
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < candles.length; i++) {
    const d = Math.abs(candles[i].t - ms)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}
