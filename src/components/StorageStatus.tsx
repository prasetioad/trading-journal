import { useStore } from '../store/store'

const DOT: Record<string, string> = {
  off: 'bg-ink-mute',
  loading: 'bg-warn animate-pulse',
  synced: 'bg-brand',
  saving: 'bg-info animate-pulse',
  error: 'bg-lose',
}
const LABEL: Record<string, string> = {
  off: 'Lokal',
  loading: 'Sheets: memuat…',
  synced: 'Sheets: tersimpan',
  saving: 'Sheets: menyimpan…',
  error: 'Sheets: gagal',
}

export function StorageStatus() {
  const { sync } = useStore()
  if (sync.status === 'off') return null
  return (
    <button
      type="button"
      onClick={sync.pushNow}
      title={sync.error ?? 'Klik untuk sinkron sekarang'}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5"
    >
      <span className={`h-2 w-2 rounded-full ${DOT[sync.status]}`} />
      <span className="text-[11px] font-semibold text-ink-soft">{LABEL[sync.status]}</span>
    </button>
  )
}
