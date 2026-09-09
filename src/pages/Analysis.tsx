import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { usePrices } from '../store/prices'
import { dateShort, num } from '../lib/format'
import { exportAnalysesCsv } from '../lib/csv'
import { isCryptoPair } from '../lib/verify'
import { Badge, Card, EmptyState, SectionTitle } from '../components/ui/primitives'
import { Modal } from '../components/ui/Modal'
import { AnalysisForm } from '../features/analysis/AnalysisForm'

const statusTone = { pending: 'warn', success: 'win', fail: 'lose' } as const

export default function Analysis() {
  const { analyses, addAnalysis, resolveAnalysis, deleteAnalysis } = useStore()
  const { prices } = usePrices()
  const [creating, setCreating] = useState(false)

  const rows = useMemo(
    () =>
      [...analyses].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [analyses],
  )

  const hit = analyses.filter((a) => a.status === 'success').length
  const resolved = analyses.filter((a) => a.status !== 'pending').length

  return (
    <div>
      <SectionTitle
        title="My Analysis / Prediction"
        hint="Setup analisa sebelum entry. Divalidasi terhadap Target vs Invalidation. (Prototype: resolusi manual — versi live: cek harga riil tiap 5 menit.)"
        right={
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => exportAnalysesCsv(analyses)}
              disabled={analyses.length === 0}
            >
              Export CSV
            </button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              + Analisa baru
            </button>
          </div>
        }
      />

      <div className="mb-4 flex gap-3 text-xs text-ink-soft">
        <span>
          Total: <span className="tnum font-semibold text-ink">{analyses.length}</span>
        </span>
        <span>
          Hit rate:{' '}
          <span className="tnum font-semibold text-ink">
            {resolved ? Math.round((hit / resolved) * 100) : 0}%
          </span>{' '}
          ({hit}/{resolved} resolved)
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Belum ada analisa" hint="Catat prediksi dengan target & invalidation price." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {rows.map((a) => {
            const live =
              a.status === 'pending' && a.asset_type === 'crypto' && isCryptoPair(a.pair)
                ? prices[a.pair]
                : undefined
            const toTarget =
              live != null ? ((a.target_price - live) / live) * 100 : null
            return (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-ink">{a.pair}</h3>
                    <Badge tone={a.bias === 'bullish' ? 'brand' : 'lose'}>{a.bias}</Badge>
                    <Badge tone={statusTone[a.status]}>{a.status}</Badge>
                    {a.analyzed_by_ai && <Badge tone="violet">AI ✓</Badge>}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-mute">
                    {a.asset_type} · dibuat {dateShort(a.created_at)}
                    {a.resolved_at && ` · resolved ${dateShort(a.resolved_at)}`}
                  </div>
                  {live != null && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                      <span className="tnum text-brand">{num(live, 8)}</span>
                      {toTarget != null && (
                        <span className="text-ink-mute">
                          · {toTarget >= 0 ? '+' : ''}
                          {toTarget.toFixed(1)}% ke target
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn btn-danger px-2 py-1 text-xs"
                  onClick={() => {
                    if (confirm('Hapus analisa ini?')) deleteAnalysis(a.id)
                  }}
                >
                  Hapus
                </button>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <Mini label="Support" value={num(a.support)} />
                <Mini label="Resistance" value={num(a.resistance)} />
                <Mini label="Target" value={num(a.target_price)} tone="win" />
                <Mini label="Invalidation" value={num(a.invalidation_price)} tone="lose" />
              </div>

              {a.technique_tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {a.technique_tags.map((t) => (
                    <Badge key={t} tone="info">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}

              {a.notes && <p className="mt-3 text-xs leading-relaxed text-ink-soft">{a.notes}</p>}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-border-soft pt-3">
                <span className="mr-1 self-center text-[11px] text-ink-mute">Tandai hasil:</span>
                <button
                  className="btn btn-ghost px-2.5 py-1 text-[11px]"
                  onClick={() => resolveAnalysis(a.id, 'success')}
                >
                  Success
                </button>
                <button
                  className="btn btn-ghost px-2.5 py-1 text-[11px]"
                  onClick={() => resolveAnalysis(a.id, 'fail')}
                >
                  Fail
                </button>
                {a.status !== 'pending' && (
                  <button
                    className="btn btn-ghost px-2.5 py-1 text-[11px]"
                    onClick={() => resolveAnalysis(a.id, 'pending')}
                  >
                    Reset ke pending
                  </button>
                )}
              </div>
            </Card>
            )
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Analisa baru" wide>
        <AnalysisForm
          onCancel={() => setCreating(false)}
          onSubmit={(d) => {
            addAnalysis(d)
            setCreating(false)
          }}
        />
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
