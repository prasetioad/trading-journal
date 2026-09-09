import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { psychologyPerformance } from '../../lib/finance'
import { DESTRUCTIVE_EMOTIONS } from '../../types'
import { money, pct } from '../../lib/format'
import { Card, EmptyState, SectionTitle } from '../../components/ui/primitives'

export function PsychologyTable() {
  const { journal } = useStore()
  const rows = useMemo(() => psychologyPerformance(journal), [journal])
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.netPnl)))

  return (
    <Card pad={false}>
      <div className="px-5 pt-5">
        <SectionTitle
          title="Audit Psikologi vs Performa"
          hint="Emosi mana yang menghasilkan profit, mana yang menghancurkan modal."
        />
      </div>
      {rows.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState title="Belum ada trade closed." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="border-y border-border text-[11px] uppercase tracking-wide text-ink-mute">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Emosi</th>
                <th className="px-3 py-2.5 text-right font-semibold">Trade</th>
                <th className="px-3 py-2.5 text-right font-semibold">Win Rate</th>
                <th className="px-3 py-2.5 text-right font-semibold">Net P/L</th>
                <th className="px-3 py-2.5 font-semibold">Kontribusi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const w = (Math.abs(r.netPnl) / maxAbs) * 100
                const bad = DESTRUCTIVE_EMOTIONS.includes(r.psychology as never)
                return (
                  <tr key={r.psychology} className="border-b border-border-soft last:border-0">
                    <td className="px-5 py-2.5">
                      <span className={bad ? 'font-medium text-lose' : 'text-ink'}>{r.psychology}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tnum text-ink-soft">{r.trades}</td>
                    <td className="px-3 py-2.5 text-right tnum">{pct(r.winRate)}</td>
                    <td
                      className={`px-3 py-2.5 text-right tnum font-semibold ${
                        r.netPnl >= 0 ? 'text-win' : 'text-lose'
                      }`}
                    >
                      {money(r.netPnl, 'IDR', { sign: true })}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={`h-full rounded-full ${r.netPnl >= 0 ? 'bg-win' : 'bg-lose'}`}
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
