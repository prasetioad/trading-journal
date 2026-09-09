import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import type { JournalEntry } from '../../types'
import { toIDR } from '../../lib/fx'
import { money } from '../../lib/format'
import { Card, SectionTitle } from '../../components/ui/primitives'
import { Modal } from '../../components/ui/Modal'

const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export function TradingCalendar() {
  const { journal } = useStore()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [day, setDay] = useState<string | null>(null)

  const byDay = useMemo(() => {
    const m = new Map<string, { pnl: number; trades: JournalEntry[] }>()
    for (const t of journal) {
      if (t.status !== 'closed' || !t.closed_at) continue
      const k = t.closed_at.slice(0, 10)
      const cur = m.get(k) ?? { pnl: 0, trades: [] }
      cur.pnl += toIDR(t.realized_pnl, t.size_currency)
      cur.trades.push(t)
      m.set(k, cur)
    }
    return m
  }, [journal])

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const first = new Date(year, month, 1)
    const startPad = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const out: ({ date: string; day: number } | null)[] = []
    for (let i = 0; i < startPad; i++) out.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
      })
    }
    return out
  }, [cursor])

  const monthNet = useMemo(() => {
    let n = 0
    for (const [k, v] of byDay) if (k.startsWith(monthKey(cursor))) n += v.pnl
    return n
  }, [byDay, cursor])

  const selected = day ? byDay.get(day) : undefined

  return (
    <Card>
      <SectionTitle
        title="Trading Calendar"
        hint="Net Realized P/L per hari. Klik tanggal untuk rincian trade."
        right={
          <div className="flex items-center gap-2 text-xs">
            <button className="btn btn-ghost px-2 py-1" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              ‹
            </button>
            <span className="tnum w-24 text-center font-semibold text-ink">
              {cursor.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
            </span>
            <button className="btn btn-ghost px-2 py-1" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
        }
      />

      <div className="mb-2 text-xs text-ink-soft">
        Net bulan ini:{' '}
        <span className={`tnum font-semibold ${monthNet >= 0 ? 'text-win' : 'text-lose'}`}>
          {money(monthNet, 'IDR', { sign: true })}
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d) => (
          <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase text-ink-mute">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />
          const rec = byDay.get(c.date)
          const tone = !rec
            ? 'border-border-soft bg-surface-2/40 text-ink-mute'
            : rec.pnl >= 0
              ? 'border-win/30 bg-win/10 text-win'
              : 'border-lose/30 bg-lose/10 text-lose'
          return (
            <button
              key={c.date}
              onClick={() => rec && setDay(c.date)}
              className={`flex min-h-[52px] flex-col rounded-lg border p-1.5 text-left transition-colors ${tone} ${rec ? 'hover:brightness-125' : 'cursor-default'}`}
            >
              <span className="text-[10px] font-semibold opacity-70">{c.day}</span>
              {rec && (
                <>
                  <span className="tnum mt-auto text-[10px] font-semibold leading-tight">
                    {money(rec.pnl, 'IDR', { sign: true })}
                  </span>
                  <span className="text-[9px] opacity-70">{rec.trades.length} trade</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      <Modal open={!!day} onClose={() => setDay(null)} title={`Trade ${day ?? ''}`}>
        {selected && (
          <div className="space-y-2">
            {selected.trades.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-[13px]"
              >
                <div>
                  <span className="font-semibold text-ink">{t.pair}</span>{' '}
                  <span className="text-ink-mute">
                    {t.direction} · {t.setup_tags.join(', ') || '—'}
                  </span>
                </div>
                <span
                  className={`tnum font-semibold ${(t.realized_pnl ?? 0) >= 0 ? 'text-win' : 'text-lose'}`}
                >
                  {money(t.realized_pnl, t.size_currency, { sign: true })}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
              <span>Net</span>
              <span className={`tnum ${selected.pnl >= 0 ? 'text-win' : 'text-lose'}`}>
                {money(selected.pnl, 'IDR', { sign: true })}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
