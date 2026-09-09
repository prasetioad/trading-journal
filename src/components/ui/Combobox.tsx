import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Searchable single-select. Type to filter `options`; click or Enter to pick.
 * With `allowFreeText`, whatever is typed is kept as the value (so unknown pairs
 * still work) — but the dropdown nudges you toward a real match to avoid typos.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  allowFreeText = true,
  autoFocus,
  maxVisible = 60,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  allowFreeText?: boolean
  autoFocus?: boolean
  maxVisible?: number
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState(value)
  const [hi, setHi] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => setQ(value), [value])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase()
    if (!needle) return options.slice(0, maxVisible)
    const starts: string[] = []
    const contains: string[] = []
    for (const o of options) {
      const u = o.toUpperCase()
      if (u.startsWith(needle)) starts.push(o)
      else if (u.includes(needle)) contains.push(o)
      if (starts.length + contains.length >= maxVisible * 2) break
    }
    return [...starts, ...contains].slice(0, maxVisible)
  }, [q, options, maxVisible])

  const commit = (v: string) => {
    onChange(v.trim().toUpperCase())
    setQ(v.trim().toUpperCase())
    setOpen(false)
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        className="field"
        value={q}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
          setHi(0)
          if (allowFreeText) onChange(e.target.value.toUpperCase())
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setOpen(true)
            setHi((h) => Math.min(h + 1, filtered.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHi((h) => Math.max(h - 1, 0))
          } else if (e.key === 'Enter') {
            if (open && filtered[hi]) {
              e.preventDefault()
              commit(filtered[hi])
            }
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
          {filtered.map((o, i) => (
            <li key={o}>
              <button
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => commit(o)}
                className={`block w-full px-3 py-1.5 text-left text-[13px] ${
                  i === hi ? 'bg-brand/15 text-brand' : 'text-ink-soft hover:bg-surface-2'
                }`}
              >
                {o}
              </button>
            </li>
          ))}
          {allowFreeText && q.trim() && !options.some((o) => o.toUpperCase() === q.trim().toUpperCase()) && (
            <li className="border-t border-border-soft">
              <button
                type="button"
                onClick={() => commit(q)}
                className="block w-full px-3 py-1.5 text-left text-[12px] text-ink-mute hover:bg-surface-2"
              >
                Pakai “{q.trim().toUpperCase()}” (tidak di daftar)
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
