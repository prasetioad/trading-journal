import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { JournalEntry } from '../types'
import { plannedRR, strategyStats } from '../lib/finance'
import { toIDR } from '../lib/fx'
import { dateShort, money, num, pct, rr } from '../lib/format'
import { unrealized } from '../lib/verify'
import { usePrices } from '../store/prices'
import { exportJournalCsv, parseJournalCsv, type ImportedTrade } from '../lib/csv'
import { runSearch } from '../lib/search'
import { Badge, Card, EmptyState, SectionTitle, StatTile } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { JournalForm } from '../features/journal/JournalForm'
import { CloseTradeDialog } from '../features/journal/CloseTradeDialog'

type Filter = 'all' | 'open' | 'closed'

export default function BacktestLab() {
  const {
    backtestJournal,
    strategies,
    addTrade,
    addTrades,
    updateTrade,
    closeTrade,
    reopenTrade,
    deleteTrade,
  } = useStore()
  const { prices } = usePrices()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importPreview, setImportPreview] = useState<{ rows: ImportedTrade[]; errors: string[] } | null>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<JournalEntry | null>(null)
  const [closing, setClosing] = useState<JournalEntry | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const stratName = useMemo(() => {
    const m = new Map(strategies.map((s) => [s.id, s.name]))
    return (id: string | null) => (id ? (m.get(id) ?? 'Strategi dihapus') : 'Tanpa Strategi')
  }, [strategies])

  const search = useMemo(
    () => (query.trim() ? runSearch(backtestJournal, strategies, query) : null),
    [backtestJournal, strategies, query],
  )

  const rows = useMemo(() => {
    let base = search ? search.trades : backtestJournal
    if (filter !== 'all') base = base.filter((t) => t.status === filter)
    return [...base].sort((a, b) => new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime())
  }, [backtestJournal, filter, search])

  const summary = useMemo(() => {
    const closed = rows.filter((t) => t.status === 'closed')
    const pnl = (t: JournalEntry) => toIDR(t.realized_pnl, t.size_currency)
    const wins = closed.filter((t) => pnl(t) > 0)
    const losses = closed.filter((t) => pnl(t) < 0)
    const sw = wins.reduce((s, t) => s + pnl(t), 0)
    const sl = Math.abs(losses.reduce((s, t) => s + pnl(t), 0))
    const wr = closed.length ? wins.length / closed.length : 0
    const lr = closed.length ? losses.length / closed.length : 0
    const aw = wins.length ? sw / wins.length : 0
    const al = losses.length ? sl / losses.length : 0
    const unrl = rows
      .filter((t) => t.status === 'open')
      .reduce((s, t) => {
        const p = prices[t.pair]
        return p != null ? s + toIDR(unrealized(t, p), t.size_currency) : s
      }, 0)
    return {
      total: rows.length,
      open: rows.filter((t) => t.status === 'open').length,
      closed: closed.length,
      winRate: wr,
      expectancy: wr * aw - lr * al,
      net: sw - sl,
      unrl,
    }
  }, [rows, prices])

  const perStrategy = useMemo(
    () =>
      strategies
        .map((s) => ({
          s,
          st: strategyStats(s.id, s.name, s.status, s.target_sample_size, backtestJournal),
        }))
        .filter((x) => x.st.closedCount + x.st.openCount > 0),
    [strategies, backtestJournal],
  )

  return (
    <div>
      <SectionTitle
        title="Backtest Lab"
        hint="Uji strategi di data historis tanpa modal real. Alurnya sama seperti Trading Journal."
        right={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setImportPreview(parseJournalCsv(await f.text(), strategies, 'backtest'))
                if (fileRef.current) fileRef.current.value = ''
              }}
            />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Import CSV
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => exportJournalCsv(backtestJournal, strategies, `backtest-lab_${new Date().toISOString().slice(0, 10)}.csv`)}
              disabled={backtestJournal.length === 0}
            >
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Trade backtest
            </button>
          </div>
        }
      />

      <div className="mb-4 rounded-lg border border-violet/30 bg-violet/5 px-3 py-2 text-xs text-ink-soft">
        Trade di sini hanya menambah data <b>Strategy League Table</b> & Playbook. Tidak masuk Net
        P/L, Equity, Discipline, Emotional Leak, Calendar, Insights, atau deteksi perilaku.
      </div>

      <div className="mb-3">
        <input
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Cari — mis. "btc breakout win 3 bulan terakhir"'
        />
        {search && (
          <div className="mt-2 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-xs text-ink-soft">
            {search.parsed.criteria.length
              ? search.parsed.criteria.join(' · ')
              : 'query tidak dikenali — menampilkan semua'}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Trade backtest" value={String(summary.total)} delta={`${summary.open} open`} />
        <StatTile label="Closed" value={String(summary.closed)} />
        <StatTile label="Win Rate" value={pct(summary.winRate)} />
        <StatTile
          label="Expectancy"
          value={money(summary.expectancy, 'IDR', { sign: true })}
          tone={summary.expectancy >= 0 ? 'win' : 'lose'}
        />
        <StatTile
          label="Net (simulasi)"
          value={money(summary.net, 'IDR', { sign: true })}
          tone={summary.net >= 0 ? 'win' : 'lose'}
        />
        <StatTile
          label="Unrealized (live)"
          value={money(summary.unrl, 'IDR', { sign: true })}
          tone={summary.unrl > 0 ? 'win' : summary.unrl < 0 ? 'lose' : 'neutral'}
        />
      </div>

      {perStrategy.length > 0 && (
        <Card className="mb-4">
          <SectionTitle title="Kontribusi ke Strategy League" hint="Sample & expectancy dari backtest per strategi." />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {perStrategy.map(({ s, st }) => (
              <div key={s.id} className="rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-xs">
                <div className="font-semibold text-ink">{s.name}</div>
                <div className="mt-0.5 text-ink-mute">
                  {st.closedCount} backtest closed · WR {pct(st.winRate)} · Exp{' '}
                  <span className={st.expectancy >= 0 ? 'text-win' : 'text-lose'}>
                    {money(st.expectancy, 'IDR', { sign: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="mb-3 flex gap-1">
        {(['all', 'open', 'closed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              filter === f ? 'bg-brand/12 text-brand' : 'bg-surface-2 text-ink-soft hover:text-ink'
            }`}
          >
            {f === 'all' ? 'Semua' : f === 'open' ? `Open (${summary.open})` : 'Closed'}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada trade backtest" hint="Klik “Trade backtest” untuk mulai menguji strategi." />
      ) : (
        <Card pad={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-wide text-ink-mute">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Tanggal</th>
                  <th className="px-3 py-2.5 font-semibold">Pair</th>
                  <th className="px-3 py-2.5 font-semibold">Strategi</th>
                  <th className="px-3 py-2.5 font-semibold">SOP</th>
                  <th className="px-3 py-2.5 text-right font-semibold">P R:R</th>
                  <th className="px-3 py-2.5 text-right font-semibold">R R:R</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Realized P/L</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const prr = plannedRR(t.entry_price, t.take_profit, t.stop_loss)
                  const live = t.status === 'open' ? prices[t.pair] : undefined
                  const uPnl = live != null ? unrealized(t, live) : null
                  return (
                    <tr key={t.id} className="border-b border-border-soft last:border-0 hover:bg-surface-2/40">
                      <td className="px-3 py-2.5 align-top whitespace-nowrap text-ink-soft">
                        {dateShort(t.entry_at)}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <div className="font-semibold text-ink">{t.pair}</div>
                        <div className="text-[11px] text-ink-mute">
                          {t.asset_type} · {t.direction}
                          {t.setup_tags.length > 0 && ` · ${t.setup_tags.join(', ')}`}
                        </div>
                        {live != null && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                            <span className="tnum text-brand">{num(live, 8)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-ink-soft">{stratName(t.strategy_id)}</td>
                      <td className="px-3 py-2.5 align-top">
                        {t.followed_plan ? <Badge tone="brand">Sesuai</Badge> : <Badge tone="lose">Melanggar</Badge>}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right tnum text-ink-soft">{rr(prr)}</td>
                      <td className="px-3 py-2.5 align-top text-right tnum text-ink-soft">{rr(t.realized_rr)}</td>
                      <td className="px-3 py-2.5 align-top text-right tnum">
                        {t.realized_pnl != null ? (
                          <span className={t.realized_pnl >= 0 ? 'text-win' : 'text-lose'}>
                            {money(t.realized_pnl, t.size_currency, { sign: true })}
                          </span>
                        ) : uPnl != null ? (
                          <span className={uPnl >= 0 ? 'text-win/80' : 'text-lose/80'} title="Unrealized (live)">
                            ~{money(uPnl, t.size_currency, { sign: true })}
                          </span>
                        ) : (
                          <span className="text-ink-mute">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {t.status === 'open' ? (
                          <Badge tone="warn">Open</Badge>
                        ) : t.outcome === 'win' ? (
                          <Badge tone="win">Win</Badge>
                        ) : t.outcome === 'lose' ? (
                          <Badge tone="lose">Lose</Badge>
                        ) : (
                          <Badge tone="neutral">Breakeven</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setEditing(t)}>
                            Edit
                          </button>
                          {t.status === 'open' ? (
                            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setClosing(t)}>
                              Tutup
                            </button>
                          ) : (
                            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => reopenTrade(t.id)}>
                              Buka lagi
                            </button>
                          )}
                          <button
                            className="btn btn-danger px-2 py-1 text-[11px]"
                            onClick={() => {
                              if (confirm('Hapus trade backtest ini?')) deleteTrade(t.id)
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Trade backtest baru" wide>
        <JournalForm
          strategies={strategies}
          onCancel={() => setCreating(false)}
          onSubmit={(d) => {
            addTrade({ ...d, mode: 'backtest' })
            setCreating(false)
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit trade backtest" wide>
        {editing && (
          <JournalForm
            strategies={strategies}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(d) => {
              updateTrade(editing.id, d)
              setEditing(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!closing} onClose={() => setClosing(null)} title="Tutup posisi backtest">
        {closing && (
          <CloseTradeDialog
            trade={closing}
            onCancel={() => setClosing(null)}
            onConfirm={(exit, mistakes) => {
              closeTrade(closing.id, exit, { mistakes })
              setClosing(null)
            }}
          />
        )}
      </Modal>

      <Modal open={!!importPreview} onClose={() => setImportPreview(null)} title="Import CSV (backtest)">
        {importPreview && (
          <div className="space-y-3 text-sm">
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">{importPreview.rows.length}</span> trade diimpor
              sebagai <span className="text-violet">backtest</span> posisi open.
            </p>
            {importPreview.errors.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-warn/30 bg-warn/5 p-2 text-[11px] text-warn">
                {importPreview.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setImportPreview(null)}>
                Batal
              </button>
              <button
                className="btn btn-primary"
                disabled={importPreview.rows.length === 0}
                onClick={() => {
                  addTrades(importPreview.rows)
                  setImportPreview(null)
                }}
              >
                Impor {importPreview.rows.length}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
