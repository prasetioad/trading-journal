import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { JournalEntry } from '../types'
import { DESTRUCTIVE_EMOTIONS } from '../types'
import { plannedRR } from '../lib/finance'
import { dateShort, money, num, pct, rr } from '../lib/format'
import { unrealized } from '../lib/verify'
import { usePrices } from '../store/prices'
import { exportJournalCsv } from '../lib/csv'
import { runSearch } from '../lib/search'
import { Badge, Card, EmptyState, SectionTitle } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { JournalForm } from '../features/journal/JournalForm'
import { CloseTradeDialog } from '../features/journal/CloseTradeDialog'
import { ReplayDialog } from '../features/journal/ReplayDialog'
import { isCryptoPair } from '../lib/verify'

type Filter = 'all' | 'open' | 'closed'

export default function Journal() {
  const { journal, strategies, addTrade, closeTrade, reopenTrade, deleteTrade } = useStore()
  const { prices } = usePrices()
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState<JournalEntry | null>(null)
  const [replaying, setReplaying] = useState<JournalEntry | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const stratName = useMemo(() => {
    const m = new Map(strategies.map((s) => [s.id, s.name]))
    return (id: string | null) => (id ? (m.get(id) ?? 'Strategi dihapus') : 'Tanpa Strategi')
  }, [strategies])

  const search = useMemo(
    () => (query.trim() ? runSearch(journal, strategies, query) : null),
    [journal, strategies, query],
  )

  const rows = useMemo(() => {
    const base = search ? search.trades : journal
    const sorted = [...base].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    if (filter === 'all') return sorted
    return sorted.filter((t) => t.status === filter)
  }, [journal, filter, search])

  const openCount = journal.filter((t) => t.status === 'open').length

  return (
    <div>
      <SectionTitle
        title="Trading Journal"
        hint="Catat setiap entry beserta emosi & kepatuhan SOP. R:R dihitung otomatis."
        right={
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => exportJournalCsv(journal, strategies)}
              disabled={journal.length === 0}
            >
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Trade baru
            </button>
          </div>
        }
      />

      <div className="mb-3">
        <input
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Cari natural language — mis. "BTC breakout london risk < 1.5% 6 bulan terakhir"'
        />
        {search && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-xs">
            <span className="text-ink-soft">
              {search.parsed.criteria.length
                ? search.parsed.criteria.join(' · ')
                : 'query tidak dikenali — menampilkan semua'}
            </span>
            <span className="ml-auto flex gap-3 text-ink-mute">
              <span className="tnum">{search.stats.count} trade</span>
              <span className="tnum">WR {pct(search.stats.winRate)}</span>
              <span className={`tnum ${search.stats.expectancy >= 0 ? 'text-win' : 'text-lose'}`}>
                Exp {money(search.stats.expectancy, 'IDR', { sign: true })}
              </span>
              <span className={`tnum ${search.stats.netPnl >= 0 ? 'text-win' : 'text-lose'}`}>
                Net {money(search.stats.netPnl, 'IDR', { sign: true })}
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="mb-3 flex gap-1">
        {(['all', 'open', 'closed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              filter === f ? 'bg-brand/12 text-brand' : 'bg-surface-2 text-ink-soft hover:text-ink'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'open' ? `Open (${openCount})` : 'Closed'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada trade" hint="Klik “Trade baru” untuk mencatat entry pertama." />
      ) : (
        <Card pad={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-wide text-ink-mute">
                <tr>
                  <Th>Tanggal</Th>
                  <Th>Pair</Th>
                  <Th>Strategi</Th>
                  <Th>SOP</Th>
                  <Th>Psikologi</Th>
                  <Th right>Planned R:R</Th>
                  <Th right>Realized R:R</Th>
                  <Th right>Realized P/L</Th>
                  <Th>Status</Th>
                  <Th right>Aksi</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const prr = plannedRR(t.entry_price, t.take_profit, t.stop_loss)
                  const leak = DESTRUCTIVE_EMOTIONS.includes(t.psychology)
                  const live = t.status === 'open' ? prices[t.pair] : undefined
                  const uPnl = live != null ? unrealized(t, live) : null
                  return (
                    <tr key={t.id} className="border-b border-border-soft last:border-0 hover:bg-surface-2/40">
                      <Td className="whitespace-nowrap text-ink-soft">{dateShort(t.created_at)}</Td>
                      <Td>
                        <div className="font-semibold text-ink">{t.pair}</div>
                        <div className="text-[11px] text-ink-mute">
                          {t.asset_type} · {t.direction}
                        </div>
                        {live != null && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                            <span className="tnum text-brand">{num(live, 8)}</span>
                          </div>
                        )}
                      </Td>
                      <Td className="text-ink-soft">{stratName(t.strategy_id)}</Td>
                      <Td>
                        {t.followed_plan ? (
                          <Badge tone="brand">Sesuai</Badge>
                        ) : (
                          <Badge tone="lose">Melanggar</Badge>
                        )}
                      </Td>
                      <Td>
                        <span className={leak ? 'text-lose' : 'text-ink-soft'}>{t.psychology}</span>
                      </Td>
                      <Td right className="tnum text-ink-soft">
                        {rr(prr)}
                      </Td>
                      <Td right className="tnum text-ink-soft">
                        {rr(t.realized_rr)}
                      </Td>
                      <Td right className="tnum">
                        {t.realized_pnl != null ? (
                          <span className={t.realized_pnl >= 0 ? 'text-win' : 'text-lose'}>
                            {money(t.realized_pnl, t.size_currency, { sign: true })}
                          </span>
                        ) : uPnl != null ? (
                          <span
                            className={uPnl >= 0 ? 'text-win/80' : 'text-lose/80'}
                            title="Unrealized (live)"
                          >
                            ~{money(uPnl, t.size_currency, { sign: true })}
                          </span>
                        ) : (
                          <span className="text-ink-mute">—</span>
                        )}
                      </Td>
                      <Td>
                        {t.status === 'open' ? (
                          <Badge tone="warn">Open</Badge>
                        ) : t.outcome === 'win' ? (
                          <Badge tone="win">Win</Badge>
                        ) : t.outcome === 'lose' ? (
                          <Badge tone="lose">Lose</Badge>
                        ) : (
                          <Badge tone="neutral">Breakeven</Badge>
                        )}
                      </Td>
                      <Td right>
                        <div className="flex justify-end gap-1">
                          {isCryptoPair(t.pair) && (
                            <button
                              className="btn btn-ghost px-2 py-1 text-[11px]"
                              onClick={() => setReplaying(t)}
                            >
                              Replay
                            </button>
                          )}
                          {t.status === 'open' ? (
                            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setClosing(t)}>
                              Tutup
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost px-2 py-1 text-[11px]"
                              onClick={() => reopenTrade(t.id)}
                            >
                              Buka lagi
                            </button>
                          )}
                          <button
                            className="btn btn-danger px-2 py-1 text-[11px]"
                            onClick={() => {
                              if (confirm('Hapus trade ini?')) deleteTrade(t.id)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Trade baru" wide>
        <JournalForm
          strategies={strategies}
          onCancel={() => setCreating(false)}
          onSubmit={(d) => {
            addTrade(d)
            setCreating(false)
          }}
        />
      </Modal>

      <Modal open={!!closing} onClose={() => setClosing(null)} title="Tutup posisi">
        {closing && (
          <CloseTradeDialog
            trade={closing}
            onCancel={() => setClosing(null)}
            onConfirm={(exit) => {
              closeTrade(closing.id, exit)
              setClosing(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!replaying} onClose={() => setReplaying(null)} title="Trade replay" wide>
        {replaying && <ReplayDialog trade={replaying} />}
      </Modal>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2.5 font-semibold ${right ? 'text-right' : ''}`}>{children}</th>
}
function Td({
  children,
  right,
  className = '',
}: {
  children: React.ReactNode
  right?: boolean
  className?: string
}) {
  return <td className={`px-3 py-2.5 align-top ${right ? 'text-right' : ''} ${className}`}>{children}</td>
}
