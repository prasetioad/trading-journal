import { useStore } from '../store/store'

const DOT: Record<string, string> = {
  off: 'bg-ink-mute',
  loading: 'bg-warn animate-pulse',
  pulling: 'bg-info animate-pulse',
  synced: 'bg-brand',
  saving: 'bg-info animate-pulse',
  error: 'bg-lose',
}
const LABEL: Record<string, string> = {
  off: 'Lokal',
  loading: 'Sheets: memuat…',
  pulling: 'Sheets: menarik ulang…',
  synced: 'Sheets: tersimpan',
  saving: 'Sheets: menyimpan…',
  error: 'Sheets: gagal',
}

export function StorageStatus() {
  const { sync } = useStore()
  if (sync.status === 'off') return null
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={sync.error ?? undefined}
        className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5"
      >
        <span className={`h-2 w-2 rounded-full ${DOT[sync.status]}`} />
        <span className="text-[11px] font-semibold text-ink-soft">{LABEL[sync.status]}</span>
      </span>
      <button
        type="button"
        disabled={sync.status === 'pulling'}
        title="Tarik ulang data dari Google Sheet — dipakai kalau tampilan di sini kelihatan salah/ketinggalan. Perubahan lokal yang belum ke-sync akan hilang (screenshot tetap aman)."
        onClick={() => {
          if (confirm('Tarik ulang data dari Google Sheet? Perubahan lokal yang belum tersimpan ke Sheet akan ditimpa.'))
            sync.pullNow()
        }}
        className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[11px] font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
      >
        ↺ Sheets
      </button>
    </div>
  )
}
