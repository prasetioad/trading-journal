import { useMemo } from 'react'
import { useStore } from '../../store/store'
import { disciplineSummary } from '../../lib/finance'
import { Card, Gauge, SectionTitle } from '../../components/ui/primitives'

export function DisciplineGauge() {
  const { journal } = useStore()
  const d = useMemo(() => disciplineSummary(journal), [journal])

  return (
    <Card>
      <SectionTitle title="Discipline Meter" hint="% trade sesuai SOP tanpa emosi destruktif." />
      <Gauge value={d.score} label={`${d.score}% disiplin`} sublabel={`${d.cleanTrades}/${d.totalClosed} trade bersih`} />
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Cell label="Bersih" value={d.cleanTrades} tone="win" />
        <Cell label="Langgar SOP" value={d.brokePlan} tone="lose" />
        <Cell label="Emosional" value={d.emotionalTrades} tone="warn" />
      </div>
    </Card>
  )
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'win' | 'lose' | 'warn'
}) {
  const vc = tone === 'win' ? 'text-win' : tone === 'lose' ? 'text-lose' : 'text-warn'
  return (
    <div className="rounded-lg border border-border-soft bg-surface-2/50 px-1.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-mute">{label}</div>
      <div className={`tnum mt-0.5 text-sm font-semibold ${vc}`}>{value}</div>
    </div>
  )
}
