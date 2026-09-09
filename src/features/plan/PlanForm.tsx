import { useState } from 'react'
import type { PlanBias, TradingPlan } from '../../types'
import { SETUP_TAGS } from '../../types'
import {
  Fieldset,
  FormRow,
  NumberInput,
  SegmentedField,
  TagPicker,
  TextArea,
  TextInput,
} from '../../components/ui/form'

export type PlanDraft = Omit<TradingPlan, 'id' | 'created_at'>

const todayStr = () => new Date().toISOString().slice(0, 10)

export function PlanForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: TradingPlan
  onSubmit: (d: PlanDraft) => void
  onCancel: () => void
}) {
  const [planDate, setPlanDate] = useState(initial?.plan_date ?? todayStr())
  const [bias, setBias] = useState<PlanBias>(initial?.bias ?? 'neutral')
  const [levels, setLevels] = useState(initial ? initial.key_levels.join(', ') : '')
  const [allowed, setAllowed] = useState<string[]>(initial?.allowed_setups ?? [])
  const [maxTrades, setMaxTrades] = useState<number>(initial?.max_trades ?? 3)
  const [maxLossR, setMaxLossR] = useState<number>(initial?.max_daily_loss_r ?? 2)
  const [noTrade, setNoTrade] = useState(initial ? initial.no_trade_rules.join('\n') : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit({
          plan_date: planDate,
          bias,
          key_levels: levels
            .split(/[,\n]/)
            .map((s) => Number(s.trim()))
            .filter((n) => Number.isFinite(n)),
          allowed_setups: allowed,
          max_trades: Math.max(1, maxTrades),
          max_daily_loss_r: Math.abs(maxLossR),
          no_trade_rules: noTrade
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean),
          notes: notes.trim(),
        })
      }}
      className="space-y-4"
    >
      <Fieldset>
        <FormRow label="Tanggal">
          <TextInput type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
        </FormRow>
        <FormRow label="Market bias">
          <SegmentedField<PlanBias>
            value={bias}
            onChange={setBias}
            options={[
              { value: 'bullish', label: 'Bullish' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'bearish', label: 'Bearish' },
            ]}
          />
        </FormRow>
      </Fieldset>

      <FormRow label="Key levels" hint="Pisahkan dengan koma — mis. 63000, 66500, 72000">
        <TextInput value={levels} onChange={(e) => setLevels(e.target.value)} placeholder="63000, 66500" />
      </FormRow>

      <FormRow label="Allowed setups" hint="Setup di luar daftar ini akan ditandai ⚠️ di Plan vs Actual">
        <TagPicker value={allowed} onChange={setAllowed} suggestions={SETUP_TAGS} />
      </FormRow>

      <Fieldset>
        <FormRow label="Max trades">
          <NumberInput
            value={maxTrades}
            min={1}
            onChange={(e) => setMaxTrades(Number(e.target.value) || 1)}
          />
        </FormRow>
        <FormRow label="Max daily loss (R)" hint="Stop trading bila realized ≤ −R ini">
          <NumberInput
            value={maxLossR}
            min={0}
            onChange={(e) => setMaxLossR(Number(e.target.value) || 0)}
          />
        </FormRow>
      </Fieldset>

      <FormRow label="No-trade rules" hint="Satu aturan per baris">
        <TextArea
          value={noTrade}
          onChange={(e) => setNoTrade(e.target.value)}
          placeholder={'Major news dalam 30 menit\nMarket choppy / tanpa struktur'}
        />
      </FormRow>

      <FormRow label="Catatan">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fokus retest range high. Skip bila R:R < 1:1.5." />
      </FormRow>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary">
          Simpan plan
        </button>
      </div>
    </form>
  )
}
