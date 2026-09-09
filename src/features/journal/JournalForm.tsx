import { useMemo, useState } from 'react'
import type {
  AssetType,
  Currency,
  MarketCondition,
  Psychology,
  Strategy,
} from '../../types'
import { MARKET_CONDITIONS, MISTAKE_TAGS, PSYCHOLOGY, SETUP_TAGS } from '../../types'
import { direction, plannedRR } from '../../lib/finance'
import { rr } from '../../lib/format'
import { putScreenshot } from '../../lib/storage'
import {
  Fieldset,
  FormRow,
  NumberInput,
  SegmentedField,
  Select,
  TagPicker,
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
  entry_at: string
  planned_entry: number | null
  setup_tags: string[]
  market_condition: MarketCondition | null
  confidence: number | null
  risk_pct: number | null
  screenshot_ref: string | null
  mistakes: string[]
}

/** value for <input type=datetime-local> from an ISO string (local tz) */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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
  const [plannedEntry, setPlannedEntry] = useState<number | ''>('')
  const [tp, setTp] = useState<number | ''>('')
  const [sl, setSl] = useState<number | ''>('')
  const [psychology, setPsychology] = useState<Psychology>('Netral')
  const [reasoning, setReasoning] = useState('')
  const [entryAt, setEntryAt] = useState<string>(() => toLocalInput(new Date().toISOString()))
  const [setupTags, setSetupTags] = useState<string[]>([])
  const [marketCondition, setMarketCondition] = useState<MarketCondition | ''>('')
  const [confidence, setConfidence] = useState<number>(6)
  const [riskPct, setRiskPct] = useState<number | ''>('')
  const [mistakes, setMistakes] = useState<string[]>([])
  const [shot, setShot] = useState<string | null>(null)
  const [shotBusy, setShotBusy] = useState(false)
  const [shotErr, setShotErr] = useState<string | null>(null)

  const prr = useMemo(() => {
    if (entry === '' || tp === '' || sl === '') return null
    return plannedRR(Number(entry), Number(tp), Number(sl))
  }, [entry, tp, sl])

  const dir = entry !== '' && tp !== '' ? direction(Number(entry), Number(tp)) : null

  const slip = useMemo(() => {
    if (entry === '' || plannedEntry === '' || !Number(plannedEntry)) return null
    return (Number(entry) - Number(plannedEntry)) / Number(plannedEntry)
  }, [entry, plannedEntry])

  const valid =
    pair.trim().length > 0 &&
    size !== '' &&
    Number(size) > 0 &&
    entry !== '' &&
    tp !== '' &&
    sl !== '' &&
    Number(sl) !== Number(entry) &&
    reasoning.trim().length > 0

  async function onFile(file: File | undefined) {
    if (!file) return
    setShotBusy(true)
    setShotErr(null)
    try {
      setShot(await putScreenshot(file))
    } catch (e) {
      setShotErr(e instanceof Error ? e.message : 'Gagal memproses gambar')
    } finally {
      setShotBusy(false)
    }
  }

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
          entry_at: new Date(entryAt).toISOString(),
          planned_entry: plannedEntry === '' ? null : Number(plannedEntry),
          setup_tags: setupTags,
          market_condition: marketCondition || null,
          confidence,
          risk_pct: riskPct === '' ? null : Number(riskPct),
          screenshot_ref: shot,
          mistakes,
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
        <FormRow label="Waktu entry" hint="Untuk analitik sesi & jam">
          <TextInput type="datetime-local" value={entryAt} onChange={(e) => setEntryAt(e.target.value)} />
        </FormRow>
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
      </Fieldset>

      <Fieldset cols={3}>
        <FormRow label="Entry (aktual)">
          <NumberInput value={entry} onChange={(e) => setEntry(e.target.value === '' ? '' : Number(e.target.value))} placeholder="61000" />
        </FormRow>
        <FormRow label="Take Profit (TP)">
          <NumberInput value={tp} onChange={(e) => setTp(e.target.value === '' ? '' : Number(e.target.value))} placeholder="64000" />
        </FormRow>
        <FormRow label="Stop Loss (SL)">
          <NumberInput value={sl} onChange={(e) => setSl(e.target.value === '' ? '' : Number(e.target.value))} placeholder="60000" />
        </FormRow>
      </Fieldset>

      <Fieldset cols={3}>
        <FormRow label="Entry rencana" hint="Harga yang plan minta (opsional)">
          <NumberInput value={plannedEntry} onChange={(e) => setPlannedEntry(e.target.value === '' ? '' : Number(e.target.value))} placeholder="60800" />
        </FormRow>
        <FormRow label="Risk % akun" hint="Untuk deteksi risk-creep">
          <NumberInput value={riskPct} min={0} onChange={(e) => setRiskPct(e.target.value === '' ? '' : Number(e.target.value))} placeholder="1" />
        </FormRow>
        <FormRow label={`Confidence: ${confidence}/10`}>
          <input
            type="range"
            min={1}
            max={10}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full accent-[var(--color-brand)]"
          />
        </FormRow>
      </Fieldset>

      <Fieldset>
        <FormRow label="Psikologi" hint="Emosi saat entry">
          <Select value={psychology} onChange={(e) => setPsychology(e.target.value as Psychology)}>
            {PSYCHOLOGY.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label="Market condition" hint="Regime market saat entry">
          <Select value={marketCondition} onChange={(e) => setMarketCondition(e.target.value as MarketCondition | '')}>
            <option value="">—</option>
            {MARKET_CONDITIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </FormRow>
      </Fieldset>

      <FormRow label="Setup tags" hint="Satu trade bisa beberapa tag — dipakai analitik per-setup">
        <TagPicker value={setupTags} onChange={setSetupTags} suggestions={SETUP_TAGS} />
      </FormRow>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2.5 text-xs">
        <span className="text-ink-mute">Kalkulasi otomatis:</span>
        <Badge tone="info">Planned R:R {rr(prr)}</Badge>
        {dir && <Badge tone={dir === 'long' ? 'brand' : 'lose'}>{dir === 'long' ? 'Long' : 'Short'}</Badge>}
        {prr != null && prr < 1.5 && <Badge tone="warn">R:R rendah — pertimbangkan skip</Badge>}
        {slip != null && Math.abs(slip) >= 0.01 && (
          <Badge tone="warn">
            Entry {slip > 0 ? 'di atas' : 'di bawah'} rencana {(Math.abs(slip) * 100).toFixed(1)}%
          </Badge>
        )}
      </div>

      <FormRow label="Alasan & Catatan" hint="Catatan teknikal bebas — dibaca oleh AI harian">
        <TextArea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Break weekly resistance, retest bersih, volume ekspansi, target swing high berikutnya."
        />
      </FormRow>

      <Fieldset>
        <FormRow label="Kesalahan eksekusi" hint="Opsional saat entry — bisa dilengkapi saat close">
          <TagPicker value={mistakes} onChange={setMistakes} suggestions={MISTAKE_TAGS} />
        </FormRow>
        <FormRow label="Screenshot" hint="Otomatis di-resize & dikompres">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="field text-xs"
          />
          {shotBusy && <p className="mt-1 text-[11px] text-ink-mute">Memproses…</p>}
          {shotErr && <p className="mt-1 text-[11px] text-lose">{shotErr}</p>}
          {shot && (
            <div className="mt-2 flex items-center gap-2">
              <img src={shot} alt="preview" className="h-16 w-24 rounded-md border border-border object-cover" />
              <button type="button" className="btn btn-ghost px-2 py-1 text-[11px]" onClick={() => setShot(null)}>
                Hapus
              </button>
            </div>
          )}
        </FormRow>
      </Fieldset>

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
