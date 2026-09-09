import type { Bucket } from '../../lib/analytics'
import { money, pct } from '../../lib/format'
import { EmptyState } from '../../components/ui/primitives'

export function BucketTable({
  rows,
  label,
  emptyHint,
}: {
  rows: Bucket[]
  label: string
  emptyHint?: string
}) {
  if (rows.length === 0) return <EmptyState title={emptyHint ?? 'Belum ada data.'} />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[13px]">
        <thead className="border-b border-border text-[11px] uppercase tracking-wide text-ink-mute">
          <tr>
            <th className="px-3 py-2 font-semibold">{label}</th>
            <th className="px-3 py-2 text-right font-semibold">Trade</th>
            <th className="px-3 py-2 text-right font-semibold">Win Rate</th>
            <th className="px-3 py-2 text-right font-semibold">Avg R</th>
            <th className="px-3 py-2 text-right font-semibold">Expectancy</th>
            <th className="px-3 py-2 text-right font-semibold">Net P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border-soft last:border-0">
              <td className="px-3 py-2 font-medium text-ink">{r.key}</td>
              <td className="tnum px-3 py-2 text-right text-ink-soft">{r.trades}</td>
              <td className="tnum px-3 py-2 text-right text-ink-soft">{pct(r.winRate)}</td>
              <td className="tnum px-3 py-2 text-right text-ink-soft">
                {r.avgRR != null ? `1:${r.avgRR}` : '—'}
              </td>
              <td
                className={`tnum px-3 py-2 text-right ${r.expectancy >= 0 ? 'text-win' : 'text-lose'}`}
              >
                {money(r.expectancy, 'IDR', { sign: true })}
              </td>
              <td className={`tnum px-3 py-2 text-right ${r.netPnl >= 0 ? 'text-win' : 'text-lose'}`}>
                {money(r.netPnl, 'IDR', { sign: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
