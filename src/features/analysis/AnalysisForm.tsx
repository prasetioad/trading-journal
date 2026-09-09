import { useState } from 'react'
import type { AnalysisBias, AssetType } from '../../types'
import {
  Fieldset,
  FormRow,
  NumberInput,
  SegmentedField,
  TextArea,
  TextInput,
} from '../../components/ui/form'

export interface AnalysisDraft {
  pair: string
  asset_type: AssetType
  bias: AnalysisBias
  support: number | null
  resistance: number | null
  target_price: number
  invalidation_price: number
  technique_tags: string[]
  notes: string
}

export function AnalysisForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (d: AnalysisDraft) => void
  onCancel: () => void
}) {
  const [pair, setPair] = useState('')
  const [asset, setAsset] = useState<AssetType>('crypto')
  const [bias, setBias] = useState<AnalysisBias>('bullish')
  const [support, setSupport] = useState<number | ''>('')
  const [resistance, setResistance] = useState<number | ''>('')
  const [target, setTarget] = useState<number | ''>('')
  const [invalidation, setInvalidation] = useState<number | ''>('')
  const [tags, setTags] = useState('')
  const [notes, setNotes] = useState('')

  const valid = pair.trim().length > 0 && target !== '' && invalidation !== ''

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit({
          pair: pair.trim().toUpperCase(),
          asset_type: asset,
          bias,
          support: support === '' ? null : Number(support),
          resistance: resistance === '' ? null : Number(resistance),
          target_price: Number(target),
          invalidation_price: Number(invalidation),
          technique_tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          notes: notes.trim(),
        })
      }}
      className="space-y-4"
    >
      <Fieldset cols={3}>
        <FormRow label="Pair">
          <TextInput value={pair} onChange={(e) => setPair(e.target.value)} placeholder="BTCUSDT" autoFocus />
        </FormRow>
        <FormRow label="Jenis aset">
          <SegmentedField<AssetType>
            value={asset}
            onChange={setAsset}
            options={[
              { value: 'crypto', label: 'Crypto' },
              { value: 'stock', label: 'Stock' },
            ]}
          />
        </FormRow>
        <FormRow label="Arah">
          <SegmentedField<AnalysisBias>
            value={bias}
            onChange={setBias}
            options={[
              { value: 'bullish', label: 'Bullish' },
              { value: 'bearish', label: 'Bearish' },
            ]}
          />
        </FormRow>
      </Fieldset>

      <Fieldset>
        <FormRow label="Support">
          <NumberInput value={support} onChange={(e) => setSupport(e.target.value === '' ? '' : Number(e.target.value))} />
        </FormRow>
        <FormRow label="Resistance">
          <NumberInput value={resistance} onChange={(e) => setResistance(e.target.value === '' ? '' : Number(e.target.value))} />
        </FormRow>
      </Fieldset>

      <Fieldset>
        <FormRow label="Target Price" hint="Prediksi tercapai → success">
          <NumberInput value={target} onChange={(e) => setTarget(e.target.value === '' ? '' : Number(e.target.value))} />
        </FormRow>
        <FormRow label="Invalidation Price" hint="Tersentuh → fail">
          <NumberInput
            value={invalidation}
            onChange={(e) => setInvalidation(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </FormRow>
      </Fieldset>

      <FormRow label="Tag Teknik Analisa" hint="Pisahkan dengan koma">
        <TextInput
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Market Structure, Demand Zone, Fibonacci"
        />
      </FormRow>

      <FormRow label="Catatan">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Skenario, konfirmasi yang ditunggu, catatan invalidasi." />
      </FormRow>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>
          Simpan analisa (pending)
        </button>
      </div>
    </form>
  )
}
