import { useMemo } from 'react'
import { useStore } from '../store/store'
import {
  byHour,
  byMarketCondition,
  bySession,
  bySetupTag,
  byWeekday,
  tradingDNA,
} from '../lib/analytics'
import { autoInsights } from '../lib/rules'
import { buildWeeklyReview } from '../lib/ai'
import { Card, SectionTitle } from '../components/ui/primitives'
import { AutoInsightCards } from '../features/insights/AutoInsightCards'
import { BucketChart } from '../features/insights/BucketChart'
import { BucketTable } from '../features/insights/BucketTable'
import { TradingDnaCard } from '../features/insights/TradingDnaCard'
import { WeeklyReviewCard } from '../features/insights/WeeklyReviewCard'

export default function Insights() {
  const { journal, strategies } = useStore()

  const d = useMemo(
    () => ({
      insights: autoInsights(journal, strategies),
      hour: byHour(journal),
      session: bySession(journal),
      weekday: byWeekday(journal),
      setup: bySetupTag(journal),
      market: byMarketCondition(journal),
      dna: tradingDNA(journal),
      weekly: buildWeeklyReview(journal, strategies),
    }),
    [journal, strategies],
  )

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Insights"
        hint="Edge, kelemahan, pola perilaku & waktu — dihitung otomatis dari jurnal. Find your trading edge."
      />

      <AutoInsightCards insights={d.insights} />

      <WeeklyReviewCard review={d.weekly} source="deterministik" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Performa per sesi" hint="Expectancy (IDR) per sesi market — UTC." />
          <BucketChart rows={d.session} emptyHint="Butuh trade closed." />
        </Card>
        <Card>
          <SectionTitle title="Performa per jam (UTC)" hint="Kapan profitmu tergerus." />
          <BucketChart rows={d.hour} emptyHint="Butuh trade closed." />
        </Card>
      </div>

      <Card>
        <SectionTitle title="Performa per setup" hint="Satu trade bisa masuk beberapa tag." />
        <BucketTable rows={d.setup} label="Setup" emptyHint="Tambahkan setup tag pada trade." />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Performa per market condition" />
          <BucketTable
            rows={d.market}
            label="Kondisi"
            emptyHint="Catat market condition saat entry."
          />
        </Card>
        <Card>
          <SectionTitle title="Performa per hari" />
          <BucketTable rows={d.weekday} label="Hari" emptyHint="Butuh trade closed." />
        </Card>
      </div>

      <TradingDnaCard dna={d.dna} />
    </div>
  )
}
