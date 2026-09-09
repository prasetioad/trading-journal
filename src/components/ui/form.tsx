import type { ReactNode } from 'react'

export function Fieldset({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 | 3 }) {
  const c = cols === 1 ? 'grid-cols-1' : cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>
}

export function FormRow({
  label,
  hint,
  children,
  className = '',
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-mute">{hint}</p>}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field ${props.className ?? ''}`} />
}

export function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input type="number" step="any" {...props} className={`field tnum ${props.className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field min-h-[84px] resize-y ${props.className ?? ''}`} />
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select {...props} className={`field ${props.className ?? ''}`}>
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  onLabel = 'Ya',
  offLabel = 'Tidak',
}: {
  checked: boolean
  onChange: (v: boolean) => void
  onLabel?: string
  offLabel?: string
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1.5 text-xs font-semibold ${checked ? 'bg-brand-dim text-[#04120c]' : 'bg-surface-2 text-ink-soft'}`}
      >
        {onLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1.5 text-xs font-semibold ${!checked ? 'bg-lose/20 text-lose' : 'bg-surface-2 text-ink-soft'}`}
      >
        {offLabel}
      </button>
    </div>
  )
}

/** Multi-select chip picker. `suggestions` are quick toggles; free text can be added. */
export function TagPicker({
  value,
  onChange,
  suggestions,
  placeholder = 'Tambah tag…',
  allowCustom = true,
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: readonly string[]
  placeholder?: string
  allowCustom?: boolean
}) {
  const toggle = (t: string) =>
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggle(s)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              value.includes(s)
                ? 'border-brand/40 bg-brand/15 text-brand'
                : 'border-border bg-surface-2 text-ink-soft hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {value.some((v) => !suggestions.includes(v)) && (
        <div className="flex flex-wrap gap-1.5">
          {value
            .filter((v) => !suggestions.includes(v))
            .map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => toggle(v)}
                className="rounded-full border border-violet/40 bg-violet/15 px-2.5 py-1 text-[11px] font-semibold text-violet"
              >
                {v} ✕
              </button>
            ))}
        </div>
      )}
      {allowCustom && (
        <input
          className="field"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            const t = (e.target as HTMLInputElement).value.trim()
            if (t && !value.includes(t)) onChange([...value, t])
            ;(e.target as HTMLInputElement).value = ''
          }}
        />
      )}
    </div>
  )
}

export function SegmentedField<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-xs font-semibold ${
            value === o.value ? 'bg-brand-dim text-[#04120c]' : 'bg-surface-2 text-ink-soft'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
