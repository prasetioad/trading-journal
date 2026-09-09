import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type ToastTone = 'info' | 'win' | 'lose' | 'warn'
interface Toast {
  id: string
  tone: ToastTone
  title: string
  body?: string
}

interface ToastApi {
  push: (t: Omit<Toast, 'id'>) => void
}

const Ctx = createContext<ToastApi | null>(null)

const toneBar: Record<ToastTone, string> = {
  info: 'bg-info',
  win: 'bg-win',
  lose: 'bg-lose',
  warn: 'bg-warn',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((cur) => [...cur, { ...t, id }])
    setTimeout(() => setToasts((cur) => cur.filter((x) => x.id !== id)), 6000)
  }, [])

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card pointer-events-auto flex gap-3 overflow-hidden p-0 shadow-lg"
          >
            <div className={`w-1 shrink-0 ${toneBar[t.tone]}`} />
            <div className="py-2.5 pr-3">
              <div className="text-[13px] font-semibold text-ink">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-ink-soft">{t.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}

/** fire-and-forget outside React (e.g. verifier) via a tiny event bus */
const bus = new EventTarget()
export function emitToast(t: Omit<Toast, 'id'>) {
  bus.dispatchEvent(new CustomEvent('toast', { detail: t }))
}
export function useToastBusBridge() {
  const { push } = useToast()
  useEffect(() => {
    const h = (e: Event) => push((e as CustomEvent).detail)
    bus.addEventListener('toast', h)
    return () => bus.removeEventListener('toast', h)
  }, [push])
}
