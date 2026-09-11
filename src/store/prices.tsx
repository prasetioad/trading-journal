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
import {
  checkAnalysis,
  checkAnalysisRange,
  checkTrade,
  checkTradeRange,
  isCryptoPair,
} from '../lib/verify'
import { fetchStockQuotes, type StockQuote } from '../lib/stocks'
import { dateTime } from '../lib/format'
import { emitToast } from '../components/ui/Toast'
import { useStore } from './store'
import type { JournalEntry } from '../types'

export type StockSyncState = 'off' | 'polling' | 'ok' | 'error'

// Backtest trades are forward paper trades — verify them only within a short
// window of entry_at, so a historical setup entered "manually today" isn't
// auto-closed against an unrelated current price.
const BACKTEST_VERIFY_WINDOW_MS = 3 * 86_400_000
function verifiable(t: JournalEntry): boolean {
  if (t.mode !== 'backtest') return true
  return Date.now() - new Date(t.entry_at).getTime() <= BACKTEST_VERIFY_WINDOW_MS
}
const btPrefix = (t: JournalEntry) => (t.mode === 'backtest' ? '(backtest) ' : '')

interface PricesValue {
  prices: Record<string, number>
  state: ConnState
  watching: string[]
  lastUpdate: number | null
  autoVerify: boolean
  setAutoVerify: (v: boolean) => void
  stock: { state: StockSyncState; watching: string[]; lastUpdate: number | null }
}

const Ctx = createContext<PricesValue | null>(null)
const AV_KEY = 'tj.autoVerify'
const STOCK_POLL_MS = 60_000

export function PricesProvider({ children }: { children: ReactNode }) {
  // allJournal: open backtest trades get a live price + unrealized P/L too
  const { allJournal: journal, analyses, closeTrade, resolveAnalysis } = useStore()
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [state, setState] = useState<ConnState>('idle')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const [stockState, setStockState] = useState<StockSyncState>('off')
  const [stockLastUpdate, setStockLastUpdate] = useState<number | null>(null)
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

  const stockWatching = useMemo(() => {
    const s = new Set<string>()
    for (const t of journal) if (t.status === 'open' && t.asset_type === 'stock' && t.pair) s.add(t.pair.toUpperCase())
    for (const a of analyses)
      if (a.status === 'pending' && a.asset_type === 'stock' && a.pair) s.add(a.pair.toUpperCase())
    return [...s].sort()
  }, [journal, analyses])
  const stockKey = stockWatching.join(',')

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

  // --- Delayed IDX/stock polling (Yahoo via Apps Script proxy or CORS proxy) ---
  useEffect(() => {
    const symbols = stockKey ? stockKey.split(',') : []
    if (symbols.length === 0) {
      setStockState('off')
      return
    }
    let alive = true
    const poll = async () => {
      setStockState((s) => (s === 'ok' ? s : 'polling'))
      try {
        const quotes = await fetchStockQuotes(symbols)
        if (!alive) return
        if (quotes.length === 0) {
          setStockState('error')
          return
        }
        setPrices((cur) => {
          const next = { ...cur }
          for (const q of quotes) next[q.symbol] = q.price
          return next
        })
        setStockState('ok')
        setStockLastUpdate(Date.now())
        runStockVerify(quotes, ref.current)
      } catch {
        if (alive) setStockState('error')
      }
    }
    void poll()
    const id = setInterval(() => void poll(), STOCK_POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [stockKey])

  const value: PricesValue = {
    prices,
    state,
    watching,
    lastUpdate,
    autoVerify,
    setAutoVerify,
    stock: { state: stockState, watching: stockWatching, lastUpdate: stockLastUpdate },
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
    if (t.pair !== pair || t.status !== 'open' || !verifiable(t)) continue
    const hit = checkTrade(t, price)
    if (!hit || acted.has(t.id)) continue
    acted.add(t.id)
    s.closeTrade(t.id, hit.exitPrice)
    setTimeout(() => acted.delete(t.id), 5000)
    emitToast({
      tone: hit.reason === 'tp' ? 'win' : 'lose',
      title: `${btPrefix(t)}${t.pair} menyentuh ${hit.reason === 'tp' ? 'Take Profit' : 'Stop Loss'}`,
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

// --- delayed stock verification (range-based; a bar can straddle SL/TP) ---
function runStockVerify(
  quotes: StockQuote[],
  s: {
    journal: ReturnType<typeof useStore>['journal']
    analyses: ReturnType<typeof useStore>['analyses']
    autoVerify: boolean
    closeTrade: ReturnType<typeof useStore>['closeTrade']
    resolveAnalysis: ReturnType<typeof useStore>['resolveAnalysis']
  },
) {
  if (!s.autoVerify) return
  const bySym = new Map(quotes.map((q) => [q.symbol, q]))

  for (const t of s.journal) {
    if (t.status !== 'open' || t.asset_type !== 'stock' || !verifiable(t)) continue
    const q = bySym.get(t.pair.toUpperCase())
    if (!q || acted.has(t.id)) continue
    const hit = checkTradeRange(t, q.dayLow, q.dayHigh)
    if (!hit) continue
    acted.add(t.id)
    s.closeTrade(t.id, hit.exitPrice)
    setTimeout(() => acted.delete(t.id), 10_000)
    emitToast({
      tone: hit.reason === 'tp' ? 'win' : 'lose',
      title: `${btPrefix(t)}${t.pair} menyentuh ${hit.reason === 'tp' ? 'Take Profit' : 'Stop Loss'}`,
      body: `Ditutup otomatis @ ${hit.exitPrice}${q.time ? ` · data per ${dateTime(new Date(q.time).toISOString())}` : ''}`,
    })
  }

  for (const a of s.analyses) {
    if (a.status !== 'pending' || a.asset_type !== 'stock') continue
    const q = bySym.get(a.pair.toUpperCase())
    if (!q || acted.has(a.id)) continue
    const hit = checkAnalysisRange(a, q.dayLow, q.dayHigh)
    if (!hit) continue
    acted.add(a.id)
    s.resolveAnalysis(a.id, hit.status)
    setTimeout(() => acted.delete(a.id), 10_000)
    emitToast({
      tone: hit.status === 'success' ? 'win' : 'lose',
      title: `Prediksi ${a.pair} ${hit.status === 'success' ? 'TERCAPAI' : 'invalid'}`,
      body: `Range hari ${q.dayLow}–${q.dayHigh}${q.time ? ` · data per ${dateTime(new Date(q.time).toISOString())}` : ''}`,
    })
  }
}

export function usePrices() {
  const v = useContext(Ctx)
  if (!v) throw new Error('usePrices must be used within PricesProvider')
  return v
}
