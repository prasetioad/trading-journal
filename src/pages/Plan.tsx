import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import type { TradingPlan } from '../types'
import { planVsActual } from '../lib/plan'
import { rr } from '../lib/format'
import { Badge, Card, EmptyState, SectionTitle } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { PlanForm } from '../features/plan/PlanForm'

const biasTone = { bullish: 'win', bearish: 'lose', neutral: 'neutral' } as const

export default function Plan() {
  const { plans, journal, addPlan, updatePlan, deletePlan } = useStore()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TradingPlan | null>(null)

  const rows = useMemo(
    () =>
      [...plans]
        .sort((a, b) => b.plan_date.localeCompare(a.plan_date))
        .map((p) => ({ p, check: planVsActual(p, journal) })),
    [plans, journal],
  )

  return (
    <div>
      <SectionTitle
        title="Trading Plan"
        hint="Rencana sebelum trading, lalu bandingkan dengan eksekusi aktual hari itu."
        right={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Plan
          </button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="Belum ada plan" hint="Buat plan harian: bias, key levels, allowed setups, batas trade & loss." />
      ) : (
        <div className="space-y-4">
          {rows.map(({ p, check }) => {
            const deviations = [
              check.tradesOver && `Trade ${check.actualTrades} > batas ${check.maxTrades}`,
              check.lossBreached && `Realized ${rr(check.realizedR)} menembus batas −${p.max_daily_loss_r}R`,
              check.disallowedSetups.length &&
                `Setup di luar rencana: ${check.disallowedSetups.join(', ')}`,
            ].filter(Boolean) as string[]

            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">{p.plan_date}</h3>
                      <Badge tone={biasTone[p.bias]}>{p.bias}</Badge>
                      {deviations.length === 0 ? (
                        <Badge tone="brand">Sesuai rencana</Badge>
                      ) : (
                        <Badge tone="lose">{deviations.length} penyimpangan</Badge>
                      )}
                    </div>
                    {p.notes && <p className="mt-1 max-w-prose text-xs text-ink-soft">{p.notes}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button
                      className="btn btn-danger px-2 py-1 text-xs"
                      onClick={() => {
                        if (confirm(`Hapus plan ${p.plan_date}?`)) deletePlan(p.id)
                      }}
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Cmp label="Trades" plan={String(p.max_trades)} actual={String(check.actualTrades)} bad={check.tradesOver} />
                  <Cmp
                    label="Daily P/L (R)"
                    plan={`≥ −${p.max_daily_loss_r}`}
                    actual={rr(check.realizedR)}
                    bad={check.lossBreached}
                  />
                  <Cmp
                    label="Avg risk %"
                    plan="—"
                    actual={check.avgRiskPct != null ? `${check.avgRiskPct}%` : '—'}
                    bad={check.avgRiskPct != null && check.avgRiskPct > 2}
                  />
                  <Cmp
                    label="Ikut SOP"
                    plan="100%"
                    actual={
                      check.followedPlanRate != null
                        ? `${Math.round(check.followedPlanRate * 100)}%`
                        : '—'
                    }
                    bad={check.followedPlanRate != null && check.followedPlanRate < 1}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.allowed_setups.map((s) => (
                    <Badge key={s} tone="info">
                      {s}
                    </Badge>
                  ))}
                  {p.key_levels.map((l) => (
                    <Badge key={l} tone="neutral">
                      ▪ {l.toLocaleString('id-ID')}
                    </Badge>
                  ))}
                </div>

                {p.no_trade_rules.length > 0 && (
                  <p className="mt-2 text-[11px] text-ink-mute">
                    No-trade: {p.no_trade_rules.join(' · ')}
                  </p>
                )}

                {deviations.length > 0 && (
                  <ul className="mt-3 space-y-1 rounded-lg border border-lose/30 bg-lose/5 p-3 text-[12px] text-lose">
                    {deviations.map((d) => (
                      <li key={d}>⚠️ {d}</li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Plan baru" wide>
        <PlanForm
          onCancel={() => setCreating(false)}
          onSubmit={(d) => {
            addPlan(d)
            setCreating(false)
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit plan" wide>
        {editing && (
          <PlanForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(d) => {
              updatePlan(editing.id, d)
              setEditing(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function Cmp({
  label,
  plan,
  actual,
  bad,
}: {
  label: string
  plan: string
  actual: string
  bad?: boolean
}) {
  return (
    <div className="rounded-lg border border-border-soft bg-surface-2/50 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className={`tnum text-[13px] font-semibold ${bad ? 'text-lose' : 'text-ink'}`}>
          {actual}
        </span>
        <span className="text-[10px] text-ink-mute">/ plan {plan}</span>
      </div>
    </div>
  )
}
