import { useMemo } from 'react'
import { useStore } from '../store/store'
import { usePrices } from '../store/prices'
import { disciplineSummary, leakSummary } from '../lib/finance'
import { toIDR } from '../lib/fx'
import { unrealized } from '../lib/verify'
import { money, num, pct } from '../lib/format'
import { SectionTitle, StatTile } from '../components/ui/primitives'
import { ExecutiveBriefing } from '../features/dashboard/ExecutiveBriefing'
import { StrategyLeagueTable } from '../features/dashboard/StrategyLeagueTable'
import { EmotionalLeakMeter } from '../features/dashboard/EmotionalLeakMeter'
import { DisciplineGauge } from '../features/dashboard/DisciplineGauge'
import { RRGapChart } from '../features/dashboard/RRGapChart'
import { EquityCurve } from '../features/dashboard/EquityCurve'
import { PsychologyTable } from '../features/dashboard/PsychologyTable'
import { LivePositions } from '../features/dashboard/LivePositions'
import { TradingCalendar } from '../features/dashboard/TradingCalendar'
import { StreakDrawdown } from '../features/dashboard/StreakDrawdown'

export default function Dashboard() {
  const { journal, strategies } = useStore()
  const { prices } = usePrices()

  const kpi = useMemo(() => {
    const closed = journal.filter((t) => t.status === 'closed')
    const open = journal.filter((t) => t.status === 'open')
    const wins = closed.filter((t) => (t.realized_pnl ?? 0) > 0)
    const net = closed.reduce((s, t) => s + toIDR(t.realized_pnl, t.size_currency), 0)
    const unrl = open.reduce((s, t) => {
      const p = prices[t.pair]
      return p != null ? s + toIDR(unrealized(t, p), t.size_currency) : s
    }, 0)
    const disc = disciplineSummary(journal)
    const leak = leakSummary(journal)
    return {
      net,
      unrl,
      winRate: closed.length ? wins.length / closed.length : 0,
      closed: closed.length,
      open: open.length,
      discipline: disc.score,
      leak: leak.leakTotal,
      activeStrategies: strategies.filter((s) => s.status !== 'archived').length,
    }
  }, [journal, strategies, prices])

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Dashboard"
        hint="Cockpit evaluasi — briefing AI, peringkat strategi, kebocoran emosi, gap eksekusi R:R, harga live."
      />

      <ExecutiveBriefing />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Net P/L (closed)"
          value={money(kpi.net, 'IDR', { sign: true })}
          tone={kpi.net >= 0 ? 'win' : 'lose'}
        />
        <StatTile
          label="Unrealized (live)"
          value={money(kpi.unrl, 'IDR', { sign: true })}
          tone={kpi.unrl > 0 ? 'win' : kpi.unrl < 0 ? 'lose' : 'neutral'}
          delta={`${kpi.open} posisi open`}
        />
        <StatTile label="Win Rate" value={pct(kpi.winRate)} delta={`${kpi.closed} closed`} />
        <StatTile
          label="Discipline"
          value={`${kpi.discipline}%`}
          tone={kpi.discipline >= 75 ? 'win' : kpi.discipline >= 45 ? 'warn' : 'lose'}
        />
        <StatTile
          label="Emotional Leak"
          value={money(kpi.leak, 'IDR', { sign: true })}
          tone={kpi.leak < 0 ? 'lose' : 'neutral'}
        />
        <StatTile label="Strategi aktif" value={num(kpi.activeStrategies, 0)} />
      </div>

      <StrategyLeagueTable />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DisciplineGauge />
        <div className="lg:col-span-2">
          <EmotionalLeakMeter />
        </div>
      </div>

      <EquityCurve />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StreakDrawdown />
        <LivePositions />
      </div>

      <TradingCalendar />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PsychologyTable />
        <RRGapChart />
      </div>
    </div>
  )
}
