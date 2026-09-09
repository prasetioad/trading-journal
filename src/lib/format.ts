import type { Currency } from '../types'

export function money(n: number | null | undefined, currency: Currency = 'IDR', opts: { sign?: boolean } = {}) {
  if (n == null || Number.isNaN(n)) return '—'
  const abs = Math.abs(n)
  const body =
    currency === 'IDR'
      ? 'Rp ' + abs.toLocaleString('id-ID', { maximumFractionDigits: 0 })
      : '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const s = n < 0 ? '−' : opts.sign ? '+' : ''
  return s + body
}

export function num(n: number | null | undefined, d = 2) {
  if (n == null || Number.isNaN(n)) return '—'
  if (!Number.isFinite(n)) return '∞'
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d })
}

export function rr(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '—'
  if (!Number.isFinite(n)) return '∞'
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  // conventional "1:x" only makes sense for a positive reward multiple
  if (n <= 0) return '−' + body + 'R'
  return '1:' + body
}

export function pct(n: number | null | undefined, d = 0) {
  if (n == null || Number.isNaN(n)) return '—'
  return (n * 100).toFixed(d) + '%'
}

export function dateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function dateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const uid = () =>
  (crypto.randomUUID?.() ?? 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))
