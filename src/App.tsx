import { useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useStore } from './store/store'
import { useToastBusBridge } from './components/ui/Toast'
import { LiveStatus } from './components/LiveStatus'
import Dashboard from './pages/Dashboard'
import Playbook from './pages/Playbook'
import Journal from './pages/Journal'
import Analysis from './pages/Analysis'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '▚' },
  { to: '/playbook', label: 'Strategy Playbook', icon: '❐' },
  { to: '/journal', label: 'Trading Journal', icon: '≣' },
  { to: '/analysis', label: 'My Analysis', icon: '◈' },
]

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { resetDemo, clearAll } = useStore()
  return (
    <>
      <div className="mb-6 flex items-center gap-2.5 px-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-dim text-[#04120c]">
          <span className="text-sm font-black">TJ</span>
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-ink">Trading Journal</div>
          <div className="text-[10px] uppercase tracking-widest text-ink-mute">Cockpit</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                isActive ? 'bg-brand/12 text-brand' : 'text-ink-soft hover:bg-surface-2 hover:text-ink'
              }`
            }
          >
            <span className="text-ink-mute">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 border-t border-border pt-3">
        <p className="px-2 text-[10px] leading-relaxed text-ink-mute">
          Data lokal (localStorage). Harga crypto live via Binance. Backend Supabase disiapkan di{' '}
          <code className="text-ink-soft">/supabase</code>.
        </p>
        <button className="btn btn-ghost w-full text-xs" onClick={resetDemo}>
          Reset data demo
        </button>
        <button
          className="btn btn-ghost w-full text-xs"
          onClick={() => {
            if (confirm('Hapus semua data lokal?')) clearAll()
          }}
        >
          Kosongkan data
        </button>
      </div>
    </>
  )
}

export default function App() {
  useToastBusBridge()
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="flex h-full">
      {/* desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/60 px-3 py-4 lg:flex">
        <SidebarContent />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside
            className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-surface px-3 py-4"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 py-2.5 backdrop-blur sm:px-6">
          <button
            className="btn btn-ghost px-2 py-1.5 text-sm lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Menu"
          >
            ☰
          </button>
          <div className="hidden text-xs text-ink-mute lg:block">Trading Journal &amp; Analysis</div>
          <LiveStatus />
        </header>

        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/playbook" element={<Playbook />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}
