import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { leakSummary } from '../../lib/finance'
import { money } from '../../lib/format'
import { Badge, Card, SectionTitle } from '../../components/ui/primitives'

export function EmotionalLeakMeter() {
  const { journal } = useStore()
  const leak = useMemo(() => leakSummary(journal), [journal])
  const improvement = leak.cleanNetPnl - leak.actualNetPnl

  return (
    <Card>
      <SectionTitle
        title="Emotional Leak Detector"
        hint="Nominal yang hilang akibat FOMO, Balas dendam & Serakah."
      />

      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Biaya kebocoran emosi"
          value={money(leak.leakTotal, 'IDR', { sign: true })}
          tone={leak.leakTotal < 0 ? 'lose' : 'neutral'}
        />
        <Tile label="Kerugian (loss saja)" value={money(-leak.leakLossOnly, 'IDR')} tone="lose" />
        <Tile
          label="P/L portofolio sekarang"
          value={money(leak.actualNetPnl, 'IDR', { sign: true })}
          tone={leak.actualNetPnl < 0 ? 'lose' : 'win'}
        />
        <Tile
          label="P/L jika tanpa trade emosi"
          value={money(leak.cleanNetPnl, 'IDR', { sign: true })}
          tone={leak.cleanNetPnl < 0 ? 'lose' : 'win'}
        />
      </div>

      {improvement > 0 && (
        <p className="mt-3 rounded-lg border border-brand/25 bg-brand/8 px-3 py-2.5 text-[13px] leading-relaxed text-ink-soft">
          Simulasi: menghilangkan trade FOMO &amp; Revenge memperbaiki P/L sebesar{' '}
          <span className="font-semibold text-brand">{money(improvement, 'IDR', { sign: true })}</span> — dari{' '}
          {money(leak.actualNetPnl, 'IDR', { sign: true })} menjadi{' '}
          {money(leak.cleanNetPnl, 'IDR', { sign: true })}.
        </p>
      )}

      {leak.offenders.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
            Rincian per emosi
          </div>
          <div className="flex flex-wrap gap-2">
            {leak.offenders.map((o) => (
              <Badge key={o.emotion} tone={o.pnl < 0 ? 'lose' : 'win'}>
                {o.emotion} · {o.count}x · {money(o.pnl, 'IDR', { sign: true })}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'win' | 'lose' | 'neutral'
}) {
  const vc = tone === 'win' ? 'text-win' : tone === 'lose' ? 'text-lose' : 'text-ink'
  return (
    <div className="rounded-xl border border-border-soft bg-surface-2/50 p-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className={`tnum mt-1 text-[15px] font-semibold ${vc}`}>{value}</div>
    </div>
  )
}
