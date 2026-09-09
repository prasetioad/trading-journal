import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { strategyStats, type StrategyStats } from '../../lib/finance'
import { money, num, pct, rr } from '../../lib/format'
import { Badge, Card, ProgressBar, SectionTitle } from '../../components/ui/primitives'

export function StrategyLeagueTable() {
  const { strategies, allJournal } = useStore()

  const btByStrat = useMemo(() => {
    const m = new Map<string | null, { bt: number; live: number }>()
    for (const t of allJournal) {
      if (t.status !== 'closed') continue
      const cur = m.get(t.strategy_id) ?? { bt: 0, live: 0 }
      if (t.mode === 'backtest') cur.bt++
      else cur.live++
      m.set(t.strategy_id, cur)
    }
    return m
  }, [allJournal])

  const rows = useMemo<StrategyStats[]>(() => {
    const s = strategies.map((x) =>
      strategyStats(x.id, x.name, x.status, x.target_sample_size, allJournal),
    )
    const noStrat = strategyStats(null, 'Tanpa Strategi / Eksperimen', 'none', 20, allJournal)
    if (noStrat.closedCount + noStrat.openCount > 0) s.push(noStrat)
    return s.sort((a, b) => b.expectancy - a.expectancy)
  }, [strategies, allJournal])

  return (
    <Card pad={false}>
      <div className="px-5 pt-5">
        <SectionTitle
          title="Strategy League Table"
          hint="Peringkat berdasarkan Expectancy. Termasuk trade Backtest Lab (rincian di kolom Sample)."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead className="border-y border-border text-[11px] uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="px-5 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Strategi</th>
              <th className="px-3 py-2.5 font-semibold">Sample</th>
              <th className="px-3 py-2.5 text-right font-semibold">Win Rate</th>
              <th className="px-3 py-2.5 text-right font-semibold">Plan → Real R:R</th>
              <th className="px-3 py-2.5 text-right font-semibold">Profit Factor</th>
              <th className="px-3 py-2.5 text-right font-semibold">Expectancy</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-xs text-ink-mute">
                  Belum ada data trade.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={r.strategyId ?? 'none'}
                className="border-b border-border-soft last:border-0 hover:bg-surface-2/40"
              >
                <td className="px-5 py-3 text-ink-mute">{i + 1}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">{r.name}</span>
                    {r.status !== 'none' && (
                      <Badge tone={r.status === 'active' ? 'brand' : r.status === 'testing' ? 'warn' : 'neutral'}>
                        {r.status}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="w-[200px] px-3 py-3">
                  <ProgressBar
                    value={r.closedCount}
                    max={r.target}
                    tone={r.sampleReady ? 'brand' : 'warn'}
                  />
                  <div className="mt-1 flex items-center gap-2">
                    {r.sampleReady ? (
                      <span className="text-[10px] text-brand">Valid sample</span>
                    ) : (
                      <span className="text-[10px] text-warn">Data belum cukup — uji terus</span>
                    )}
                    {(() => {
                      const c = btByStrat.get(r.strategyId ?? null)
                      return c && c.bt > 0 ? (
                        <span className="text-[10px] text-ink-mute">
                          {c.live} live · <span className="text-violet">{c.bt} bt</span>
                        </span>
                      ) : null
                    })()}
                  </div>
                </td>
                <td className="px-3 py-3 text-right tnum">{pct(r.winRate)}</td>
                <td className="px-3 py-3 text-right tnum text-ink-soft">
                  {rr(r.plannedRRavg)} <span className="text-ink-mute">→</span>{' '}
                  <span className={rrGapTone(r)}>{rr(r.realizedRRavg)}</span>
                </td>
                <td className="px-3 py-3 text-right tnum">
                  {r.profitFactor == null ? '—' : num(r.profitFactor, 2)}
                </td>
                <td className="px-3 py-3 text-right">
                  <span className={`tnum font-semibold ${r.expectancy >= 0 ? 'text-win' : 'text-lose'}`}>
                    {money(r.expectancy)}
                  </span>
                  <div className="text-[10px] text-ink-mute">per trade</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function rrGapTone(r: StrategyStats) {
  if (r.plannedRRavg == null || r.realizedRRavg == null) return 'text-ink-soft'
  return r.realizedRRavg < r.plannedRRavg * 0.7 ? 'text-warn' : 'text-ink'
}
