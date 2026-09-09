import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { Strategy } from '../types'
import { strategyStats } from '../lib/finance'
import { money, num, pct, rr } from '../lib/format'
import { Badge, Card, EmptyState, ProgressBar, SectionTitle } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { StrategyForm } from '../features/playbook/StrategyForm'

const statusTone = { testing: 'warn', active: 'brand', archived: 'neutral' } as const

export default function Playbook() {
  const { strategies, journal, addStrategy, updateStrategy, deleteStrategy } = useStore()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Strategy | null>(null)

  const rows = useMemo(
    () =>
      strategies.map((s) => ({
        s,
        stats: strategyStats(s.id, s.name, s.status, s.target_sample_size, journal),
      })),
    [strategies, journal],
  )

  return (
    <div>
      <SectionTitle
        title="Strategy Playbook"
        hint="Definisikan strategi & komitmen uji sampel sebelum menilai. Fondasi anti strategy-hopping."
        right={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Strategi baru
          </button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="Belum ada strategi"
          hint="Tambahkan minimal satu strategi dengan target sampel (default 20 trade)."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map(({ s, stats }) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{s.name}</h3>
                    <Badge tone={statusTone[s.status]}>{s.status}</Badge>
                  </div>
                  <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-soft">
                    {s.description || <span className="text-ink-mute">Tanpa deskripsi SOP.</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(s)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-danger px-2 py-1 text-xs"
                    onClick={() => {
                      if (confirm(`Hapus strategi "${s.name}"? Trade terkait jadi tanpa strategi.`))
                        deleteStrategy(s.id)
                    }}
                  >
                    Hapus
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-soft">
                  <span>Sample progress</span>
                  {stats.sampleReady ? (
                    <Badge tone="brand">Valid Sample</Badge>
                  ) : (
                    <Badge tone="warn">Data belum cukup — uji terus</Badge>
                  )}
                </div>
                <ProgressBar
                  value={stats.closedCount}
                  max={s.target_sample_size}
                  tone={stats.sampleReady ? 'brand' : 'warn'}
                />
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <Mini label="Win Rate" value={pct(stats.winRate)} />
                <Mini label="Planned R:R" value={rr(stats.plannedRRavg)} />
                <Mini label="Realized R:R" value={rr(stats.realizedRRavg)} />
                <Mini
                  label="Expectancy"
                  value={money(stats.expectancy)}
                  tone={stats.expectancy >= 0 ? 'win' : 'lose'}
                />
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                <Mini label="Closed" value={num(stats.closedCount, 0)} />
                <Mini label="Open" value={num(stats.openCount, 0)} />
                <Mini
                  label="Profit Factor"
                  value={stats.profitFactor == null ? '—' : num(stats.profitFactor, 2)}
                />
                <Mini
                  label="Net P/L"
                  value={money(stats.netPnl)}
                  tone={stats.netPnl >= 0 ? 'win' : 'lose'}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Strategi baru">
        <StrategyForm
          onCancel={() => setCreating(false)}
          onSubmit={(d) => {
            addStrategy(d)
            setCreating(false)
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit strategi">
        {editing && (
          <StrategyForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(d) => {
              updateStrategy(editing.id, d)
              setEditing(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'win' | 'lose'
}) {
  const vc = tone === 'win' ? 'text-win' : tone === 'lose' ? 'text-lose' : 'text-ink'
  return (
    <div className="rounded-lg border border-border-soft bg-surface-2/50 px-1.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className={`tnum mt-0.5 text-[13px] font-semibold ${vc}`}>{value}</div>
    </div>
  )
}
