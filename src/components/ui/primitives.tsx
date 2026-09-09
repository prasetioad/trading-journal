import type { ReactNode } from 'react'

/* ---------------- Card ---------------- */
export function Card({
  children,
  className = '',
  pad = true,
}: {
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  return <div className={`card ${pad ? 'p-5' : ''} ${className}`}>{children}</div>
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string
  hint?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
      </div>
      {right}
    </div>
  )
}

/* ---------------- Badge ---------------- */
type Tone = 'neutral' | 'win' | 'lose' | 'warn' | 'info' | 'violet' | 'brand'
const toneClass: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-soft border-border',
  win: 'bg-win/12 text-win border-win/30',
  lose: 'bg-lose/12 text-lose border-lose/30',
  warn: 'bg-warn/12 text-warn border-warn/30',
  info: 'bg-info/12 text-info border-info/30',
  violet: 'bg-violet/12 text-violet border-violet/30',
  brand: 'bg-brand/12 text-brand border-brand/30',
}
export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ---------------- ProgressBar ---------------- */
export function ProgressBar({
  value,
  max,
  tone = 'brand',
  showLabel = true,
}: {
  value: number
  max: number
  tone?: 'brand' | 'warn' | 'info'
  showLabel?: boolean
}) {
  const pctv = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const bar =
    tone === 'warn' ? 'bg-warn' : tone === 'info' ? 'bg-info' : 'bg-brand'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pctv}%` }} />
      </div>
      {showLabel && (
        <span className="tnum shrink-0 text-[11px] text-ink-soft">
          {value}/{max}
        </span>
      )}
    </div>
  )
}

/* ---------------- Gauge (semicircle) ---------------- */
export function Gauge({
  value,
  label,
  sublabel,
}: {
  value: number // 0..100
  label: string
  sublabel?: string
}) {
  const v = Math.max(0, Math.min(100, value))
  const r = 52
  const circ = Math.PI * r // semicircle length
  const dash = (v / 100) * circ
  const color = v >= 75 ? 'var(--color-win)' : v >= 45 ? 'var(--color-warn)' : 'var(--color-lose)'
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 66" className="w-full max-w-[220px]">
        <path
          d="M6 60 A54 54 0 0 1 114 60"
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M6 60 A54 54 0 0 1 114 60"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
        <text x="60" y="50" textAnchor="middle" className="tnum" fontSize="22" fill="var(--color-ink)" fontWeight="700">
          {Math.round(v)}
        </text>
      </svg>
      <div className="mt-1 text-center">
        <div className="text-xs font-semibold text-ink">{label}</div>
        {sublabel && <div className="text-[11px] text-ink-mute">{sublabel}</div>}
      </div>
    </div>
  )
}

/* ---------------- StatTile ---------------- */
export function StatTile({
  label,
  value,
  delta,
  tone = 'neutral',
}: {
  label: string
  value: ReactNode
  delta?: string
  tone?: 'neutral' | 'win' | 'lose' | 'warn'
}) {
  const vc =
    tone === 'win' ? 'text-win' : tone === 'lose' ? 'text-lose' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="rounded-xl border border-border-soft bg-surface-2/60 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">{label}</div>
      <div className={`tnum mt-1 text-lg font-semibold ${vc}`}>{value}</div>
      {delta && <div className="mt-0.5 text-[11px] text-ink-mute">{delta}</div>}
    </div>
  )
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  )
}
