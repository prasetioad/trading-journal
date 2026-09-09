import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { PriceFeed, type ConnState } from '../lib/binance'
import { checkAnalysis, checkTrade, isCryptoPair } from '../lib/verify'
import { emitToast } from '../components/ui/Toast'
import { useStore } from './store'

interface PricesValue {
  prices: Record<string, number>
  state: ConnState
  watching: string[]
  lastUpdate: number | null
  autoVerify: boolean
  setAutoVerify: (v: boolean) => void
}

const Ctx = createContext<PricesValue | null>(null)
const AV_KEY = 'tj.autoVerify'

export function PricesProvider({ children }: { children: ReactNode }) {
  const { journal, analyses, closeTrade, resolveAnalysis } = useStore()
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [state, setState] = useState<ConnState>('idle')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [autoVerify, setAutoVerifyState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(AV_KEY) !== '0'
    } catch {
      return true
    }
  })
  const setAutoVerify = (v: boolean) => {
    setAutoVerifyState(v)
    try {
      localStorage.setItem(AV_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  // latest data for the tick handler (avoids stale closures / feed churn)
  const ref = useRef({ journal, analyses, autoVerify, closeTrade, resolveAnalysis })
  ref.current = { journal, analyses, autoVerify, closeTrade, resolveAnalysis }

  const watching = useMemo(() => {
    const s = new Set<string>()
    for (const t of journal) if (t.status === 'open' && t.asset_type === 'crypto' && isCryptoPair(t.pair)) s.add(t.pair)
    for (const a of analyses)
      if (a.status === 'pending' && a.asset_type === 'crypto' && isCryptoPair(a.pair)) s.add(a.pair)
    return [...s].sort()
  }, [journal, analyses])

  const feedRef = useRef<PriceFeed | null>(null)
  if (!feedRef.current) {
    feedRef.current = new PriceFeed({
      onState: setState,
      onTick: (pair, price) => {
        if (!Number.isFinite(price)) return
        setPrices((cur) => (cur[pair] === price ? cur : { ...cur, [pair]: price }))
        setLastUpdate(Date.now())
        runVerify(pair, price, ref.current)
      },
    })
  }

  useEffect(() => {
    feedRef.current!.setPairs(watching)
  }, [watching])

  useEffect(() => () => feedRef.current?.stop(), [])

  const value: PricesValue = {
    prices,
    state,
    watching,
    lastUpdate,
    autoVerify,
    setAutoVerify,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// guard so one price spike doesn't fire the same close twice before state settles
const acted = new Set<string>()

function runVerify(
  pair: string,
  price: number,
  s: {
    journal: ReturnType<typeof useStore>['journal']
    analyses: ReturnType<typeof useStore>['analyses']
    autoVerify: boolean
    closeTrade: ReturnType<typeof useStore>['closeTrade']
    resolveAnalysis: ReturnType<typeof useStore>['resolveAnalysis']
  },
) {
  if (!s.autoVerify) return

  for (const t of s.journal) {
    if (t.pair !== pair || t.status !== 'open') continue
    const hit = checkTrade(t, price)
    if (!hit || acted.has(t.id)) continue
    acted.add(t.id)
    s.closeTrade(t.id, hit.exitPrice)
    setTimeout(() => acted.delete(t.id), 5000)
    emitToast({
      tone: hit.reason === 'tp' ? 'win' : 'lose',
      title: `${t.pair} menyentuh ${hit.reason === 'tp' ? 'Take Profit' : 'Stop Loss'}`,
      body: `Ditutup otomatis @ ${hit.exitPrice}`,
    })
  }

  for (const a of s.analyses) {
    if (a.pair !== pair || a.status !== 'pending') continue
    const hit = checkAnalysis(a, price)
    if (!hit || acted.has(a.id)) continue
    acted.add(a.id)
    s.resolveAnalysis(a.id, hit.status)
    setTimeout(() => acted.delete(a.id), 5000)
    emitToast({
      tone: hit.status === 'success' ? 'win' : 'lose',
      title: `Prediksi ${a.pair} ${hit.status === 'success' ? 'TERCAPAI' : 'invalid'}`,
      body:
        hit.status === 'success'
          ? `Harga menyentuh target ${a.target_price}`
          : `Harga menyentuh invalidation ${a.invalidation_price}`,
    })
  }
}

export function usePrices() {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePrices must be used within PricesProvider')
  return v
}
