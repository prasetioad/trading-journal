import { usePrices } from '../store/prices'

const dot: Record<string, string> = {
  live: 'bg-brand',
  polling: 'bg-info',
  connecting: 'bg-warn',
  reconnecting: 'bg-warn',
  error: 'bg-lose',
  idle: 'bg-ink-mute',
}
const label: Record<string, string> = {
  live: 'LIVE',
  polling: 'LIVE (poll)',
  connecting: 'menyambung…',
  reconnecting: 'menyambung ulang…',
  error: 'feed error',
  idle: 'idle',
}

export function LiveStatus() {
  const { state, watching, autoVerify, setAutoVerify } = usePrices()
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5">
        <span
          className={`h-2 w-2 rounded-full ${dot[state]} ${
            state === 'live' || state === 'polling' ? 'animate-pulse' : ''
          }`}
        />
        <span className="text-[11px] font-semibold text-ink-soft">
          {label[state]}
          {(state === 'live' || state === 'polling') && watching.length > 0 && (
            <span className="text-ink-mute"> · {watching.length} pair crypto</span>
          )}
        </span>
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
        <input
          type="checkbox"
          checked={autoVerify}
          onChange={(e) => setAutoVerify(e.target.checked)}
          className="accent-[var(--color-brand-dim)]"
        />
        Auto SL/TP
      </label>
    </div>
  )
}
