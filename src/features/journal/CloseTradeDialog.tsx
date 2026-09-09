import { useState } from 'react'
import type { JournalEntry } from '../../types'
import { MISTAKE_TAGS } from '../../types'
import { outcomeOf, realizedPnl, realizedRR } from '../../lib/finance'
import { money, rr } from '../../lib/format'
import { FormRow, NumberInput, TagPicker } from '../../components/ui/form'
import { Badge } from '../../components/ui/primitives'

export function CloseTradeDialog({
  trade,
  onConfirm,
  onCancel,
}: {
  trade: JournalEntry
  onConfirm: (exitPrice: number, mistakes: string[]) => void
  onCancel: () => void
}) {
  const [exit, setExit] = useState<number | ''>('')
  const [mistakes, setMistakes] = useState<string[]>(trade.mistakes)
  const preview =
    exit === ''
      ? null
      : {
          pnl: realizedPnl(trade, Number(exit)),
          rrv: realizedRR(trade, Number(exit)),
        }
  const oc = preview ? outcomeOf(preview.pnl) : null

  // misconfigured levels: exit at SL but profit, or exit at TP but loss
  const levelWarn =
    preview != null &&
    ((Number(exit) === trade.stop_loss && oc === 'win') ||
      (Number(exit) === trade.take_profit && oc === 'lose'))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (exit === '') return
        onConfirm(Number(exit), mistakes)
      }}
      className="space-y-4"
    >
      <div className="rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2.5 text-xs text-ink-soft">
        <span className="font-semibold text-ink">{trade.pair}</span> · {trade.direction} · Entry{' '}
        <span className="tnum">{trade.entry_price}</span> · TP <span className="tnum">{trade.take_profit}</span> · SL{' '}
        <span className="tnum">{trade.stop_loss}</span>
      </div>

      <FormRow label="Harga keluar (Exit)" hint="Isi manual — atau nilai TP/SL bila tersentuh">
        <NumberInput
          value={exit}
          onChange={(e) => setExit(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder={String(trade.take_profit)}
          autoFocus
        />
      </FormRow>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setExit(trade.take_profit)}>
          Pakai TP
        </button>
        <button type="button" className="btn btn-ghost text-xs" onClick={() => setExit(trade.stop_loss)}>
          Pakai SL
        </button>
      </div>

      <FormRow label="Kesalahan eksekusi (opsional)" hint="Dipakai engine perilaku & discipline score">
        <TagPicker value={mistakes} onChange={setMistakes} suggestions={MISTAKE_TAGS} />
      </FormRow>

      {preview && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-soft bg-surface-2/50 px-3 py-2.5 text-xs">
          <Badge tone={oc === 'win' ? 'win' : oc === 'lose' ? 'lose' : 'neutral'}>
            {oc === 'win' ? 'Win' : oc === 'lose' ? 'Lose' : 'Breakeven'}
          </Badge>
          <span className={preview.pnl >= 0 ? 'text-win' : 'text-lose'}>
            Realized P/L {money(preview.pnl, trade.size_currency, { sign: true })}
          </span>
          <Badge tone="info">Realized R:R {rr(preview.rrv)}</Badge>
        </div>
      )}

      {levelWarn && (
        <p className="rounded-lg border border-lose/40 bg-lose/10 px-3 py-2 text-[12px] text-lose">
          ⚠️ Keluar di {Number(exit) === trade.stop_loss ? 'SL' : 'TP'} tapi hasilnya{' '}
          {oc === 'win' ? 'profit' : 'rugi'} — kemungkinan harga {Number(exit) === trade.stop_loss ? 'SL' : 'TP'} salah
          input. Batalkan, perbaiki lewat <b>Edit trade</b> dulu.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Batal
        </button>
        <button type="submit" className="btn btn-primary" disabled={exit === ''}>
          Tutup posisi
        </button>
      </div>
    </form>
  )
}
