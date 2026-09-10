import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import type { JournalEntry } from '../types'
import { DESTRUCTIVE_EMOTIONS, sessionOf } from '../types'
import { plannedRR, ruleCompliance } from '../lib/finance'
import { toIDR } from '../lib/fx'
import { behaviorFlags, disciplineByTrade, type FlagKind } from '../lib/rules'
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
type Sort = 'date' | 'discipline' | 'pnl' | 'rr' | 'confidence'

const FLAG_META: Record<FlagKind, { short: string; tone: 'lose' | 'warn' | 'info' | 'neutral' }> = {
  revenge: { short: 'Revenge', tone: 'lose' },
  'risk-creep': { short: 'Risk creep', tone: 'warn' },
  overtrading: { short: 'Overtrade', tone: 'warn' },
  'late-entry': { short: 'Late entry', tone: 'info' },
  'cut-profit-early': { short: 'Cut cepat', tone: 'neutral' },
}

export default function Journal() {
  const {
    journal,
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
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('date')
  const [groupByDay, setGroupByDay] = useState(false)
  const [query, setQuery] = useState('')

  const stratName = useMemo(() => {
    const m = new Map(strategies.map((s) => [s.id, s.name]))
    return (id: string | null) => (id ? (m.get(id) ?? 'Strategi dihapus') : 'Tanpa Strategi')
  }, [strategies])

  // discipline + behavior flags are computed over the WHOLE journal (context matters)
  const disc = useMemo(() => disciplineByTrade(journal), [journal])
  const flagsByTrade = useMemo(() => {
    const m = new Map<string, FlagKind[]>()
    for (const f of behaviorFlags(journal)) {
      const arr = m.get(f.tradeId) ?? []
      if (!arr.includes(f.kind)) arr.push(f.kind)
      m.set(f.tradeId, arr)
    }
    return m
  }, [journal])

  const search = useMemo(
    () => (query.trim() ? runSearch(journal, strategies, query) : null),
    [journal, strategies, query],
  )

  const rows = useMemo(() => {
    let base = search ? search.trades : journal
    if (filter !== 'all') base = base.filter((t) => t.status === filter)
    const s = [...base]
    const pnl = (t: JournalEntry) => toIDR(t.realized_pnl, t.size_currency)
    s.sort((a, b) => {
      switch (sort) {
        case 'discipline':
          return (disc.get(a.id)?.score ?? 100) - (disc.get(b.id)?.score ?? 100)
        case 'pnl':
          return pnl(b) - pnl(a)
        case 'rr':
          return (b.realized_rr ?? -Infinity) - (a.realized_rr ?? -Infinity)
        case 'confidence':
          return (b.confidence ?? 0) - (a.confidence ?? 0)
        default:
          return new Date(b.entry_at).getTime() - new Date(a.entry_at).getTime()
      }
    })
    return s
  }, [journal, filter, sort, search, disc])

  const summary = useMemo(() => {
    const closed = rows.filter((t) => t.status === 'closed')
    const pnl = (t: JournalEntry) => toIDR(t.realized_pnl, t.size_currency)
    const wins = closed.filter((t) => pnl(t) > 0)
    const losses = closed.filter((t) => pnl(t) < 0)
    const sumWin = wins.reduce((x, t) => x + pnl(t), 0)
    const sumLoss = Math.abs(losses.reduce((x, t) => x + pnl(t), 0))
    const wr = closed.length ? wins.length / closed.length : 0
    const lr = closed.length ? losses.length / closed.length : 0
    const avgWin = wins.length ? sumWin / wins.length : 0
    const avgLoss = losses.length ? sumLoss / losses.length : 0
    const discScores = rows.map((t) => disc.get(t.id)?.score ?? 100)
    const flagged = rows.filter((t) => (flagsByTrade.get(t.id)?.length ?? 0) > 0).length
    return {
      total: rows.length,
      open: rows.filter((t) => t.status === 'open').length,
      winRate: wr,
      expectancy: wr * avgWin - lr * avgLoss,
      netPnl: sumWin - sumLoss,
      avgDiscipline: discScores.length
        ? Math.round(discScores.reduce((a, b) => a + b, 0) / discScores.length)
        : 100,
      flagged,
    }
  }, [rows, disc, flagsByTrade])

  const dayGroups = useMemo(() => {
    if (!groupByDay) return null
    const pnl = (t: JournalEntry) => toIDR(t.realized_pnl, t.size_currency)
    const map = new Map<string, JournalEntry[]>()
    for (const t of rows) {
      const k = t.entry_at.slice(0, 10)
      ;(map.get(k) ?? map.set(k, []).get(k)!).push(t)
    }
    return [...map.entries()].map(([date, list]) => {
      const net = list.reduce((s, t) => s + pnl(t), 0)
      const revenge = list.some((t) => flagsByTrade.get(t.id)?.includes('revenge'))
      const tilt = list.length >= 4 || revenge
      return { date, list, net, tilt }
    })
  }, [rows, groupByDay, flagsByTrade])

  return (
    <div>
      <SectionTitle
        title="Trading Journal"
        hint="Catat, edit, dan lihat pola eksekusimu. Sinyal perilaku & skor disiplin dihitung otomatis."
        right={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setImportPreview(parseJournalCsv(await f.text(), strategies))
                if (fileRef.current) fileRef.current.value = ''
              }}
            />
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              Import CSV
            </button>
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
          <div className="mt-2 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2 text-xs text-ink-soft">
            {search.parsed.criteria.length
              ? search.parsed.criteria.join(' · ')
              : 'query tidak dikenali — menampilkan semua'}
          </div>
        )}
      </div>

      {/* pattern summary — over the currently visible rows */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Trade tampil" value={num(summary.total, 0)} delta={`${summary.open} open`} />
        <StatTile label="Win Rate" value={pct(summary.winRate)} />
        <StatTile
          label="Expectancy"
          value={money(summary.expectancy, 'IDR', { sign: true })}
          tone={summary.expectancy >= 0 ? 'win' : 'lose'}
        />
        <StatTile
          label="Net P/L"
          value={money(summary.netPnl, 'IDR', { sign: true })}
          tone={summary.netPnl >= 0 ? 'win' : 'lose'}
        />
        <StatTile
          label="Avg Discipline"
          value={`${summary.avgDiscipline}%`}
          tone={summary.avgDiscipline >= 75 ? 'win' : summary.avgDiscipline >= 50 ? 'warn' : 'lose'}
        />
        <StatTile
          label="Ada sinyal perilaku"
          value={num(summary.flagged, 0)}
          tone={summary.flagged > 0 ? 'warn' : 'neutral'}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
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
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          Urut:
          <select
            className="field !w-auto !py-1 text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
          >
            <option value="date">Tanggal (terbaru)</option>
            <option value="discipline">Discipline (terburuk dulu)</option>
            <option value="pnl">Realized P/L</option>
            <option value="rr">Realized R:R</option>
            <option value="confidence">Confidence</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-soft">
          <input
            type="checkbox"
            checked={groupByDay}
            onChange={(e) => setGroupByDay(e.target.checked)}
            className="accent-[var(--color-brand)]"
          />
          Kelompokkan per hari
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada trade" hint="Klik “Trade baru” untuk mencatat entry pertama." />
      ) : (
        <Card pad={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-wide text-ink-mute">
                <tr>
                  <Th>Waktu</Th>
                  <Th>Pair</Th>
                  <Th>Strategi / konteks</Th>
                  <Th>Eksekusi</Th>
                  <Th>Sinyal</Th>
                  <Th right>P R:R</Th>
                  <Th right>R R:R</Th>
                  <Th right>Realized P/L</Th>
                  <Th>Status</Th>
                  <Th right>Aksi</Th>
                </tr>
              </thead>
              {groupByDay && dayGroups ? (
                dayGroups.map((g) => (
                  <tbody key={g.date}>
                    <tr className="bg-surface-2/60">
                      <td colSpan={10} className="px-3 py-1.5 text-[11px]">
                        <span className="font-semibold text-ink">{g.date}</span>
                        <span className="ml-3 text-ink-mute">{g.list.length} trade</span>
                        <span
                          className={`ml-3 tnum font-semibold ${g.net >= 0 ? 'text-win' : 'text-lose'}`}
                        >
                          {money(g.net, 'IDR', { sign: true })}
                        </span>
                        {g.tilt && (
                          <Badge tone="lose" className="ml-3">
                            Kemungkinan tilt day
                          </Badge>
                        )}
                      </td>
                    </tr>
                    {g.list.map((t) => (
                      <Row
                        key={t.id}
                        t={t}
                        stratName={stratName}
                        price={t.status === 'open' ? prices[t.pair] : undefined}
                        discipline={disc.get(t.id)?.score ?? 100}
                        flags={flagsByTrade.get(t.id) ?? []}
                        onEdit={() => setEditing(t)}
                        onClose={() => setClosing(t)}
                        onReopen={() => reopenTrade(t.id)}
                        onDelete={() => deleteTrade(t.id)}
                        onShot={() => setLightbox(t.screenshot_ref)}
                      />
                    ))}
                  </tbody>
                ))
              ) : (
                <tbody>
                  {rows.map((t) => (
                    <Row
                      key={t.id}
                      t={t}
                      stratName={stratName}
                      price={t.status === 'open' ? prices[t.pair] : undefined}
                      discipline={disc.get(t.id)?.score ?? 100}
                      flags={flagsByTrade.get(t.id) ?? []}
                      onEdit={() => setEditing(t)}
                      onClose={() => setClosing(t)}
                      onReopen={() => reopenTrade(t.id)}
                      onDelete={() => deleteTrade(t.id)}
                      onShot={() => setLightbox(t.screenshot_ref)}
                    />
                  ))}
                </tbody>
              )}
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

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit trade" wide>
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

      <Modal open={!!closing} onClose={() => setClosing(null)} title="Tutup posisi">
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

      <Modal open={!!lightbox} onClose={() => setLightbox(null)} title="Screenshot" wide>
        {lightbox && <img src={lightbox} alt="Screenshot trade" className="max-h-[70vh] w-full rounded-lg object-contain" />}
      </Modal>

      <Modal open={!!importPreview} onClose={() => setImportPreview(null)} title="Import CSV">
        {importPreview && (
          <div className="space-y-3 text-sm">
            <p className="text-ink-soft">
              <span className="font-semibold text-ink">{importPreview.rows.length}</span> trade siap
              diimpor sebagai <span className="text-warn">posisi open</span> (data exit diabaikan).
            </p>
            {importPreview.errors.length > 0 && (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-warn/30 bg-warn/5 p-2 text-[11px] text-warn">
                {importPreview.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {importPreview.rows.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border-soft text-[12px]">
                {importPreview.rows.slice(0, 20).map((r, i) => (
                  <div key={i} className="flex justify-between border-b border-border-soft px-2 py-1 last:border-0">
                    <span className="font-medium text-ink">{r.pair}</span>
                    <span className="tnum text-ink-mute">
                      {r.entry_price} → TP {r.take_profit} / SL {r.stop_loss}
                    </span>
                  </div>
                ))}
              </div>
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
                Impor {importPreview.rows.length} trade
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Row({
  t,
  stratName,
  price,
  discipline,
  flags,
  onEdit,
  onClose,
  onReopen,
  onDelete,
  onShot,
}: {
  t: JournalEntry
  stratName: (id: string | null) => string
  price: number | undefined
  discipline: number
  flags: FlagKind[]
  onEdit: () => void
  onClose: () => void
  onReopen: () => void
  onDelete: () => void
  onShot: () => void
}) {
  const prr = plannedRR(t.entry_price, t.take_profit, t.stop_loss)
  const comp = ruleCompliance(t)
  const leak = DESTRUCTIVE_EMOTIONS.includes(t.psychology)
  const uPnl = price != null ? unrealized(t, price) : null
  const discTone =
    discipline >= 80 ? 'text-win' : discipline >= 50 ? 'text-warn' : 'text-lose'

  return (
    <tr className="border-b border-border-soft last:border-0 hover:bg-surface-2/40">
      <Td className="whitespace-nowrap text-ink-soft">
        <div>{dateShort(t.entry_at)}</div>
        <div className="text-[10px] text-ink-mute">
          {new Date(t.entry_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ·{' '}
          {sessionOf(t.entry_at)}
        </div>
      </Td>

      <Td>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-ink">{t.pair}</span>
          {t.screenshot_ref && (
            <button onClick={onShot} title="Lihat screenshot" className="text-ink-mute hover:text-ink">
              ▦
            </button>
          )}
        </div>
        <div className="text-[11px] text-ink-mute">
          {t.asset_type} · {t.direction}
          {t.confidence != null && ` · conf ${t.confidence}`}
        </div>
        {t.setup_tags.length > 0 && (
          <div className="mt-0.5 text-[10px] text-ink-mute">{t.setup_tags.join(' · ')}</div>
        )}
        {price != null && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            <span className="tnum text-brand">{num(price, 8)}</span>
          </div>
        )}
      </Td>

      <Td className="text-ink-soft">
        <div>{stratName(t.strategy_id)}</div>
        <div className="mt-0.5 text-[10px] text-ink-mute">
          {t.market_condition ?? 'kondisi —'}
          {t.risk_pct != null && ` · risk ${t.risk_pct}%`}
        </div>
      </Td>

      <Td>
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            {t.followed_plan ? (
              <Badge tone="brand">SOP</Badge>
            ) : (
              <Badge tone="lose">Langgar SOP</Badge>
            )}
            {comp != null && (
              <Badge tone={comp === 1 ? 'brand' : comp >= 0.5 ? 'warn' : 'lose'}>
                {t.rule_checks.filter((r) => r.checked).length}/{t.rule_checks.length} aturan
              </Badge>
            )}
          </div>
          <span className={`text-[11px] ${leak ? 'text-lose' : 'text-ink-soft'}`}>{t.psychology}</span>
          {t.mistakes.length > 0 && (
            <span className="text-[10px] text-lose/80">{t.mistakes.join(', ')}</span>
          )}
        </div>
      </Td>

      <Td>
        <div className="flex flex-col items-start gap-1">
          <span className={`tnum text-[12px] font-semibold ${discTone}`} title="Discipline score trade ini">
            {discipline}%
          </span>
          {flags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {flags.map((f) => (
                <Badge key={f} tone={FLAG_META[f].tone}>
                  {FLAG_META[f].short}
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-[10px] text-ink-mute">bersih</span>
          )}
        </div>
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
          <span className={uPnl >= 0 ? 'text-win/80' : 'text-lose/80'} title="Unrealized (live)">
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
        <div className="flex flex-wrap justify-end gap-1">
          <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={onEdit}>
            Edit
          </button>
          {t.status === 'open' ? (
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={onClose}>
              Tutup
            </button>
          ) : (
            <button className="btn btn-ghost px-2 py-1 text-[11px]" onClick={onReopen}>
              Buka lagi
            </button>
          )}
          <button
            className="btn btn-danger px-2 py-1 text-[11px]"
            onClick={() => {
              if (confirm('Hapus trade ini?')) onDelete()
            }}
          >
            ✕
          </button>
        </div>
      </Td>
    </tr>
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
