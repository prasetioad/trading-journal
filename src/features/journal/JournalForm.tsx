import { useMemo, useState } from 'react'
import type { AssetType, Currency, Psychology, Strategy } from '../../types'
import { PSYCHOLOGY } from '../../types'
import { direction, plannedRR } from '../../lib/finance'
import { rr } from '../../lib/format'
import {
  Fieldset,
  FormRow,
  NumberInput,
  SegmentedField,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '../../components/ui/form'
import { Badge } from '../../components/ui/primitives'

export interface TradeDraft {
  asset_type: AssetType
  pair: string
  strategy_id: string | null
  followed_plan: boolean
  size_amount: number
  size_currency: Currency
  entry_price: number
  take_profit: number
  stop_loss: number
  psychology: Psychology
  reasoning: string
}

export function JournalForm({
  strategies,
  onSubmit,
  onCancel,
}: {
  strategies: Strategy[]
  onSubmit: (d: TradeDraft) => void
  onCancel: () => void
}) {
  const [asset, setAsset] = useState<AssetType>('crypto')
  const [pair, setPair] = useState('')
  const [strategyId, setStrategyId] = useState<string>(strategies[0]?.id ?? '')
  const [followed, setFollowed] = useState(true)
  const [size, setSize] = useState<number | ''>('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [entry, setEntry] = useState<number | ''>('')
  const [tp, setTp] = useState<number | ''>('')
  const [sl, setSl] = useState<number | ''>('')
  const [psychology, setPsychology] = useState<Psychology>('Netral')
  const [reasoning, setReasoning] = useState('')

  const prr = useMemo(() => {
    if (entry === '' || tp === '' || sl === '') return null
    return plannedRR(Number(entry), Number(tp), Number(sl))
  }, [entry, tp, sl])

  const dir = entry !== '' && tp !== '' ? direction(Number(entry), Number(tp)) : null

  const valid =
    pair.trim().length > 0 &&
    size !== '' &&
    Number(size) > 0 &&
    entry !== '' &&
    tp !== '' &&
    sl !== '' &&
    Number(sl) !== Number(entry) &&
    reasoning.trim().length > 0

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({
          asset_type: asset,
          pair: pair.trim().toUpperCase(),
          strategy_id: strategyId || null,
          followed_plan: followed,
          size_amount: Number(size),
          size_currency: currency,
          entry_price: Number(entry),
          take_profit: Number(tp),
          stop_loss: Number(sl),
          psychology,
          reasoning: reasoning.trim(),
        })
      }}
      className="space-y-4"
    >
      <Fieldset>
        <FormRow label="Jenis aset">
          <SegmentedField<AssetType>
            value={asset}
            onChange={(v) => {
              setAsset(v)
              setCurrency(v === 'stock' ? 'IDR' : 'USD')
            }}
            options={[
              { value: 'crypto', label: 'Crypto' },
              { value: 'stock', label: 'Stock (IDX)' },
            ]}
          />
        </FormRow>
        <FormRow label="Pair" hint={asset === 'crypto' ? 'Mis. BTCUSDT' : 'Mis. BBCA'}>
          <TextInput
            value={pair}
            onChange={(e) => setPair(e.target.value)}
            placeholder={asset === 'crypto' ? 'BTCUSDT' : 'BBCA'}
            autoFocus
          />
        </FormRow>
      </Fieldset>

      <Fieldset>
        <FormRow label="Strategi" hint="Dipilih dari Playbook">
          <Select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
            <option value="">Tanpa Strategi / Eksperimen</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.status})
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Sesuai Rencana?" hint="Entry 100% mematuhi aturan strategi?">
          <Toggle checked={followed} onChange={setFollowed} />
        </FormRow>
      </Fieldset>

      <Fieldset cols={3}>
        <FormRow label="Size">
          <NumberInput value={size} min={0} onChange={(e) => setSize(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1000" />
        </FormRow>
        <FormRow label="Mata uang">
          <SegmentedField<Currency>
            value={currency}
            onChange={setCurrency}
            options={[
              { value: 'IDR', label: 'IDR' },
              { value: 'USD', label: 'USD' },
            ]}
          />
        </FormRow>
        <FormRow label="Psikologi" hint="Emosi saat entry">
          <Select value={psychology} onChange={(e) => setPsychology(e.target.value as Psychology)}>
            {PSYCHOLOGY.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormRow>
      </Fieldset>

      <Fieldset cols={3}>
        <FormRow label="Entry">
          <NumberInput value={entry} onChange={(e) => setEntry(e.target.value === '' ? '' : Number(e.target.value))} placeholder="61000" />
        </FormRow>
        <FormRow label="Take Profit (TP)">
          <NumberInput value={tp} onChange={(e) => setTp(e.target.value === '' ? '' : Number(e.target.value))} placeholder="64000" />
        </FormRow>
        <FormRow label="Stop Loss (SL)">
          <NumberInput value={sl} onChange={(e) => setSl(e.target.value === '' ? '' : Number(e.target.value))} placeholder="60000" />
        </FormRow>
      </Fieldset>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2.5 text-xs">
        <span className="text-ink-mute">Kalkulasi otomatis:</span>
        <Badge tone="info">Planned R:R {rr(prr)}</Badge>
        {dir && <Badge tone={dir === 'long' ? 'brand' : 'lose'}>{dir === 'long' ? 'Long' : 'Short'}</Badge>}
        {prr != null && prr < 1.5 && <Badge tone="warn">R:R rendah — pertimbangkan skip</Badge>}
      </div>

      <FormRow label="Alasan & Catatan" hint="Catatan teknikal bebas — dibaca oleh AI harian">
        <TextArea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Break weekly resistance, retest bersih, volume ekspansi, target swing high berikutnya."
        />
      </FormRow>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          Simpan trade (Open)
        </button>
      </div>
    </form>
  )
}
