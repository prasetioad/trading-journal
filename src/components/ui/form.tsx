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
