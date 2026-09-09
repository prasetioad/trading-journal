import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { usePrices } from '../../store/prices'
import { unrealized, progressToTP, isCryptoPair } from '../../lib/verify'
import { toIDR } from '../../lib/fx'
import { money, num } from '../../lib/format'
import { Badge, Card, EmptyState, SectionTitle } from '../../components/ui/primitives'

export function LivePositions() {
  const { journal } = useStore()
  const { prices, state } = usePrices()

  const open = useMemo(() => journal.filter((t) => t.status === 'open'), [journal])
  const totalUnrealizedIDR = open.reduce((s, t) => {
    const p = prices[t.pair]
    return p != null ? s + toIDR(unrealized(t, p), t.size_currency) : s
  }, 0)

  return (
    <Card>
      <SectionTitle
        title="Live Positions"
        hint="Posisi terbuka + unrealized P/L dari harga live Binance."
        right={
          <Badge tone={state === 'live' ? 'brand' : state === 'polling' ? 'info' : 'warn'}>
            {state === 'live' ? 'LIVE' : state === 'polling' ? 'LIVE (poll)' : state}
          </Badge>
        }
      />
      {open.length === 0 ? (
        <EmptyState title="Tidak ada posisi terbuka." />
      ) : (
        <>
          <div className="mb-3 text-xs text-ink-soft">
            Total unrealized (≈IDR):{' '}
            <span className={`tnum font-semibold ${totalUnrealizedIDR >= 0 ? 'text-win' : 'text-lose'}`}>
              {money(totalUnrealizedIDR, 'IDR', { sign: true })}
            </span>
          </div>
          <div className="space-y-2">
            {open.map((t) => {
              const p = prices[t.pair]
              const hasLive = p != null && t.asset_type === 'crypto' && isCryptoPair(t.pair)
              const u = hasLive ? unrealized(t, p) : null
              const prog = hasLive ? progressToTP(t, p) : 0
              return (
                <div key={t.id} className="rounded-xl border border-border-soft bg-surface-2/50 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{t.pair}</span>
                      <Badge tone={t.direction === 'long' ? 'brand' : 'lose'}>{t.direction}</Badge>
                    </div>
                    <div className="tnum text-[13px]">
                      {hasLive ? (
                        <span className={u! >= 0 ? 'text-win' : 'text-lose'}>
                          {money(u!, t.size_currency, { sign: true })}
                        </span>
                      ) : (
                        <span className="text-ink-mute">harga manual</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-ink-mute">
                    <span className="tnum">SL {num(t.stop_loss, 8)}</span>
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-lose/25">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand"
                        style={{ width: `${Math.max(0, Math.min(100, prog * 100))}%` }}
                      />
                    </div>
                    <span className="tnum">TP {num(t.take_profit, 8)}</span>
                  </div>
                  {hasLive && (
                    <div className="mt-1 text-center text-[11px] text-brand tnum">
                      now {num(p, 8)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}
