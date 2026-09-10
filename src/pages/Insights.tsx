import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/store'
import {
  byHour,
  byMarketCondition,
  byReason,
  byRuleCompliance,
  bySession,
  bySetupTag,
  byWeekday,
  tradingDNA,
} from '../lib/analytics'
import { autoInsights } from '../lib/rules'
import { generateWeeklyReview, type WeeklyReviewResult } from '../lib/ai/engine'
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
      reason: byReason(journal),
      compliance: byRuleCompliance(journal),
      dna: tradingDNA(journal),
    }),
    [journal, strategies],
  )

  const [weekly, setWeekly] = useState<WeeklyReviewResult | null>(null)
  const [wLoading, setWLoading] = useState(false)
  const runWeekly = useCallback(async () => {
    setWLoading(true)
    try {
      setWeekly(await generateWeeklyReview(journal, strategies))
    } finally {
      setWLoading(false)
    }
  }, [journal, strategies])
  useEffect(() => {
    void runWeekly()
  }, [runWeekly])

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Insights"
        hint="Edge, kelemahan, pola perilaku & waktu — dihitung otomatis dari jurnal. Find your trading edge."
      />

      <AutoInsightCards insights={d.insights} />

      {weekly && (
        <WeeklyReviewCard
          review={weekly}
          source={weekly.source === 'claude-api' ? 'Claude API' : 'deterministik'}
          loading={wLoading}
          onRegenerate={runWeekly}
        />
      )}

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

      <Card>
        <SectionTitle
          title="Rule Compliance vs Performa"
          hint="Kepatuhan checklist aturan entry strategi (PRD §8) — mengukur kualitas eksekusi, bukan kualitas strategi."
        />
        <BucketTable
          rows={d.compliance}
          label="Compliance"
          emptyHint="Definisikan aturan entry di Strategy Playbook, lalu isi checklist saat input trade."
        />
      </Card>

      <Card>
        <SectionTitle
          title="Performa per alasan"
          hint="Win rate & expectancy per kata kunci di kolom 'Alasan & Catatan' — kosakata TA + istilahmu sendiri yang berulang. Satu trade bisa masuk beberapa baris."
        />
        <BucketTable
          rows={d.reason}
          label="Alasan / kata kunci"
          emptyHint="Butuh ≥ 2 trade closed dengan catatan yang mengandung kata kunci sama."
        />
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
