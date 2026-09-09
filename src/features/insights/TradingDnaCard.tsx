import type { TradingDNA } from '../../lib/analytics'
import { Badge, Card, SectionTitle } from '../../components/ui/primitives'

export function TradingDnaCard({ dna }: { dna: TradingDNA }) {
  const rows: [string, string][] = [
    ['Best market', dna.bestMarket ?? '—'],
    ['Best setup', dna.bestSetup ?? '—'],
    ['Best session', dna.bestSession ?? '—'],
    ['Best hour (UTC)', dna.bestHour != null ? `${dna.bestHour}:00` : '—'],
    [
      'Optimal risk',
      dna.optimalRisk ? `${dna.optimalRisk.lo}–${dna.optimalRisk.hi}%` : '—',
    ],
  ]
  return (
    <Card>
      <SectionTitle
        title="Trading DNA"
        hint={`Profil dari ${dna.sampleClosed} trade closed — Spotify Wrapped versi trading.`}
      />
      {dna.sampleClosed < 5 ? (
        <p className="py-6 text-center text-xs text-ink-mute">
          Butuh ≥ 5 trade closed untuk membentuk profil.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {rows.map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border-soft bg-surface-2/50 p-2.5">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{k}</dt>
                <dd className="mt-0.5 text-sm font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-win">
                Strength
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dna.strengths.length ? (
                  dna.strengths.map((s) => (
                    <Badge key={s} tone="win">
                      ✓ {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-ink-mute">—</span>
                )}
              </div>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-lose">
                Weakness
              </div>
              <div className="flex flex-wrap gap-1.5">
                {dna.weaknesses.length ? (
                  dna.weaknesses.map((s) => (
                    <Badge key={s} tone="lose">
                      ✗ {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-ink-mute">—</span>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
