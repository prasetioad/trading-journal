import { useMemo, useState } from 'react'
import type { Strategy, StrategyStatus } from '../../types'
import { parseRules } from '../../lib/finance'
import { Fieldset, FormRow, NumberInput, SegmentedField, TextArea, TextInput } from '../../components/ui/form'
import { Badge } from '../../components/ui/primitives'

export interface StrategyDraft {
  name: string
  description: string
  target_sample_size: number
  status: StrategyStatus
  entry_rules: string[]
}

export function StrategyForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Strategy
  onSubmit: (d: StrategyDraft) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [target, setTarget] = useState(initial?.target_sample_size ?? 20)
  const [status, setStatus] = useState<StrategyStatus>(initial?.status ?? 'testing')
  const [rulesText, setRulesText] = useState((initial?.entry_rules ?? []).join('\n'))

  const rules = useMemo(() => parseRules(rulesText), [rulesText])
  // decision #3: a strategy can only be 'active' if it has at least one entry rule
  const needsRules = status === 'active' && rules.length === 0
  const valid = name.trim().length > 1 && target > 0 && !needsRules

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({
          name: name.trim(),
          description: description.trim(),
          target_sample_size: target,
          status,
          entry_rules: rules,
        })
      }}
      className="space-y-4"
    >
      <FormRow label="Nama Strategi" hint="Mis. Breakout Retest, Supply-Demand Reversal, SnR Bounce">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Breakout Retest" autoFocus />
      </FormRow>

      <FormRow label="Deskripsi & SOP" hint="Ringkasan aturan entry, konfirmasi, dan exit">
        <TextArea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Entry saat harga retest level breakout dengan volume naik. SL di bawah retest. TP di swing high berikutnya."
        />
      </FormRow>

      <FormRow
        label="Aturan entry (checklist)"
        hint="Satu aturan per baris. Muncul sebagai checklist saat input trade untuk mengukur kepatuhan eksekusi."
      >
        <TextArea
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          className="min-h-[120px]"
          placeholder={'Break level kunci dengan close H4\nVolume ekspansi saat break\nRetest bersih tanpa wick panjang\nPlanned R:R minimal 1:2'}
        />
        {rules.length > 0 && (
          <p className="mt-1 text-[11px] text-ink-mute">{rules.length} aturan akan jadi checklist.</p>
        )}
      </FormRow>

      <Fieldset>
        <FormRow label="Target Sample Size" hint="Default 20 trade — komitmen uji sebelum menilai strategi">
          <NumberInput value={target} min={1} onChange={(e) => setTarget(Number(e.target.value))} />
        </FormRow>
        <FormRow label="Status">
          <SegmentedField<StrategyStatus>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'testing', label: 'Testing' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          {needsRules && (
            <div className="mt-1.5">
              <Badge tone="lose">Status “Active” butuh minimal 1 aturan entry</Badge>
            </div>
          )}
        </FormRow>
      </Fieldset>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          {initial ? 'Simpan perubahan' : 'Tambah strategi'}
        </button>
      </div>
    </form>
  )
}
