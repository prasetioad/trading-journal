import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AssetType,
  Currency,
  JournalEntry,
  MarketCondition,
  Psychology,
  RuleCheck,
  Strategy,
} from '../../types'
import { MARKET_CONDITIONS, MISTAKE_TAGS, PSYCHOLOGY, SETUP_TAGS } from '../../types'
import { direction, plannedRR, reconcileRuleChecks, slOnLossSide } from '../../lib/finance'
import { rr } from '../../lib/format'
import { putScreenshot } from '../../lib/storage'
import { CRYPTO_PAIRS, loadCryptoPairs } from '../../lib/pairs'
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
import { Combobox } from '../../components/ui/Combobox'
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
  rule_checks: RuleCheck[]
  /** edit mode only, for a closed trade whose exit was mis-typed */
  exit_price?: number
}

/** value for <input type=datetime-local> from an ISO string (local tz) */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function JournalForm({
  strategies,
  initial,
  onSubmit,
  onCancel,
}: {
  strategies: Strategy[]
  /** present → edit mode: prefill every field, relabel the submit button */
  initial?: JournalEntry
  onSubmit: (d: TradeDraft) => void
  onCancel: () => void
}) {
  const edit = !!initial
  const [asset, setAsset] = useState<AssetType>(initial?.asset_type ?? 'crypto')
  const [pair, setPair] = useState(initial?.pair ?? '')
  const [strategyId, setStrategyId] = useState<string>(
    initial ? (initial.strategy_id ?? '') : (strategies[0]?.id ?? ''),
  )
  const [followed, setFollowed] = useState(initial?.followed_plan ?? true)
  const [size, setSize] = useState<number | ''>(initial?.size_amount ?? '')
  const [currency, setCurrency] = useState<Currency>(initial?.size_currency ?? 'USD')
  const [entry, setEntry] = useState<number | ''>(initial?.entry_price ?? '')
  const [plannedEntry, setPlannedEntry] = useState<number | ''>(initial?.planned_entry ?? '')
  const [tp, setTp] = useState<number | ''>(initial?.take_profit ?? '')
  const [sl, setSl] = useState<number | ''>(initial?.stop_loss ?? '')
  const [psychology, setPsychology] = useState<Psychology>(initial?.psychology ?? 'Netral')
  const [reasoning, setReasoning] = useState(initial?.reasoning ?? '')
  const [entryAt, setEntryAt] = useState<string>(
    toLocalInput(initial?.entry_at ?? new Date().toISOString()),
  )
  const [setupTags, setSetupTags] = useState<string[]>(initial?.setup_tags ?? [])
  const [marketCondition, setMarketCondition] = useState<MarketCondition | ''>(
    initial?.market_condition ?? '',
  )
  const [confidence, setConfidence] = useState<number>(initial?.confidence ?? 6)
  const [riskPct, setRiskPct] = useState<number | ''>(initial?.risk_pct ?? '')
  const [mistakes, setMistakes] = useState<string[]>(initial?.mistakes ?? [])
  const [shot, setShot] = useState<string | null>(initial?.screenshot_ref ?? null)
  const [shotBusy, setShotBusy] = useState(false)
  const [shotErr, setShotErr] = useState<string | null>(null)
  const editingClosed = edit && initial?.status === 'closed'
  const [exitPrice, setExitPrice] = useState<number | ''>(initial?.exit_price ?? '')

  const rulesOf = (id: string) => strategies.find((s) => s.id === id)?.entry_rules ?? []
  const [ruleChecks, setRuleChecks] = useState<RuleCheck[]>(() =>
    initial
      ? reconcileRuleChecks(initial.rule_checks, rulesOf(initial.strategy_id ?? ''))
      : rulesOf(strategies[0]?.id ?? '').map((r) => ({ rule: r, checked: false })),
  )
  const lastStratId = useRef(strategyId)
  useEffect(() => {
    if (lastStratId.current === strategyId) return
    lastStratId.current = strategyId
    const rules = strategies.find((s) => s.id === strategyId)?.entry_rules ?? []
    setRuleChecks((cur) => reconcileRuleChecks(cur, rules))
  }, [strategyId, strategies])
  const compliance =
    ruleChecks.length > 0 ? ruleChecks.filter((r) => r.checked).length / ruleChecks.length : null

  const [cryptoPairs, setCryptoPairs] = useState<string[]>(CRYPTO_PAIRS)
  useEffect(() => {
    let live = true
    loadCryptoPairs().then((p) => live && setCryptoPairs(p))
    return () => {
      live = false
    }
  }, [])

  const prr = useMemo(() => {
    if (entry === '' || tp === '' || sl === '') return null
    return plannedRR(Number(entry), Number(tp), Number(sl))
  }, [entry, tp, sl])

  const dir = entry !== '' && tp !== '' ? direction(Number(entry), Number(tp)) : null

  const slSideOk =
    entry === '' || tp === '' || sl === ''
      ? true
      : slOnLossSide(Number(entry), Number(tp), Number(sl))

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
    slSideOk &&
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
          rule_checks: ruleChecks,
          ...(editingClosed && exitPrice !== '' ? { exit_price: Number(exitPrice) } : {}),
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
              if (!edit) setCurrency(v === 'stock' ? 'IDR' : 'USD')
            }}
            options={[
              { value: 'crypto', label: 'Crypto' },
              { value: 'stock', label: 'Stock (IDX)' },
            ]}
          />
        </FormRow>
        <FormRow
          label="Pair"
          hint={asset === 'crypto' ? 'Ketik untuk cari — dari daftar Binance' : 'Mis. BBCA'}
        >
          {asset === 'crypto' ? (
            <Combobox
              value={pair}
              onChange={setPair}
              options={cryptoPairs}
              placeholder="BTCUSDT"
              autoFocus={!edit}
            />
          ) : (
            <TextInput
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              placeholder="BBCA"
              autoFocus={!edit}
            />
          )}
        </FormRow>
      </Fieldset>

      <Fieldset>
        <FormRow label="Strategi" hint="Dipilih dari Playbook — bisa diubah kapan saja">
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

      {editingClosed && (
        <FormRow label="Harga keluar (Exit)" hint="Perbaiki bila salah input — Realized P/L & R:R dihitung ulang">
          <NumberInput
            value={exitPrice}
            onChange={(e) => setExitPrice(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </FormRow>
      )}

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

      {ruleChecks.length > 0 && (
        <FormRow
          label="Checklist aturan entry"
          hint="Centang aturan strategi yang benar-benar terpenuhi saat entry — jadi Rule Compliance Score."
        >
          <div className="space-y-1.5 rounded-lg border border-border-soft bg-surface-2/40 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${
                  compliance === 1 ? 'text-win' : compliance != null && compliance >= 0.5 ? 'text-warn' : 'text-lose'
                }`}
              >
                Compliance {ruleChecks.filter((r) => r.checked).length}/{ruleChecks.length}
                {compliance != null && ` (${Math.round(compliance * 100)}%)`}
              </span>
              <button
                type="button"
                className="btn btn-ghost px-2 py-1 text-[11px]"
                onClick={() => setRuleChecks((cur) => cur.map((r) => ({ ...r, checked: true })))}
              >
                Centang semua
              </button>
            </div>
            {ruleChecks.map((rc) => (
              <label key={rc.rule} className="flex cursor-pointer items-start gap-2 text-[13px] text-ink-soft">
                <input
                  type="checkbox"
                  checked={rc.checked}
                  onChange={() =>
                    setRuleChecks((cur) =>
                      cur.map((x) => (x.rule === rc.rule ? { ...x, checked: !x.checked } : x)),
                    )
                  }
                  className="mt-0.5 accent-[var(--color-brand)]"
                />
                <span className={rc.checked ? 'text-ink' : ''}>{rc.rule}</span>
              </label>
            ))}
          </div>
        </FormRow>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2.5 text-xs">
        <span className="text-ink-mute">Kalkulasi otomatis:</span>
        <Badge tone="info">Planned R:R {rr(prr)}</Badge>
        {dir && <Badge tone={dir === 'long' ? 'brand' : 'lose'}>{dir === 'long' ? 'Long' : 'Short'}</Badge>}
        {prr != null && prr < 1.5 && <Badge tone="warn">R:R rendah — pertimbangkan skip</Badge>}
        {compliance != null && (
          <Badge tone={compliance === 1 ? 'brand' : compliance >= 0.5 ? 'warn' : 'lose'}>
            Compliance {Math.round(compliance * 100)}%
          </Badge>
        )}
        {compliance != null && compliance < 1 && followed && (
          <Badge tone="warn">
            “Sesuai rencana” tapi {ruleChecks.filter((r) => !r.checked).length} aturan tak tercentang
          </Badge>
        )}
        {!slSideOk && dir && (
          <Badge tone="lose">
            SL di sisi yang salah — untuk {dir === 'long' ? 'long, SL harus < entry' : 'short, SL harus > entry'}
          </Badge>
        )}
        {slip != null && Math.abs(slip) >= 0.01 && (
          <Badge tone="warn">
            Entry {slip > 0 ? 'di atas' : 'di bawah'} rencana {(Math.abs(slip) * 100).toFixed(1)}%
          </Badge>
        )}
      </div>

      <FormRow label="Alasan & Catatan" hint="Catatan teknikal bebas — dibaca AI harian & analitik 'per alasan'">
        <TextArea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Break weekly resistance, retest bersih, volume ekspansi, target swing high berikutnya."
        />
      </FormRow>

      <Fieldset>
        <FormRow label="Kesalahan eksekusi" hint="Opsional — bisa dilengkapi saat/ setelah close">
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
          {edit ? 'Simpan perubahan' : 'Simpan trade (Open)'}
        </button>
      </div>
    </form>
  )
}
