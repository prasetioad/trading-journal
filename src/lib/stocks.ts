// Delayed IDX (and other) stock quotes for auto SL/TP verification.
//
// Free quote APIs (Yahoo, Stooq) don't send CORS headers, so a browser can't
// call them directly. Two paths, in order of preference:
//   1. The user's Apps Script Web App (VITE_SHEETS_WEBAPP_URL) — add ?action=quote,
//      UrlFetchApp has no CORS limits. See google-apps-script/Code.gs.
//   2. A public CORS proxy in front of Yahoo's chart endpoint (best-effort).
//
// Quotes are ~15 min delayed for IDX on Yahoo's free tier — that's fine, the
// verifier records closed_at at detection time and uses the day range so an
// intraday SL/TP touch isn't missed.
import { sheetsTarget } from './sheets'

export interface StockQuote {
  symbol: string // bare, e.g. "BBCA"
  price: number
  dayLow: number
  dayHigh: number
  time: number // ms epoch, exchange time (0 if unknown)
  currency: string
}

const PROXY =
  (import.meta.env.VITE_STOCK_PROXY as string | undefined)?.trim() ||
  'https://api.allorigins.win/raw?url='

/** IDX symbols need a `.JK` suffix on Yahoo; pass through anything already qualified. */
export function toYahoo(symbol: string): string {
  const s = symbol.trim().toUpperCase()
  return s.includes('.') ? s : `${s}.JK`
}

function bare(yahooSymbol: string): string {
  return yahooSymbol.replace(/\.[A-Z]+$/i, '')
}

interface YahooMeta {
  regularMarketPrice?: number
  regularMarketDayLow?: number
  regularMarketDayHigh?: number
  regularMarketTime?: number
  currency?: string
}

function fromMeta(sym: string, m: YahooMeta): StockQuote | null {
  const price = Number(m.regularMarketPrice)
  if (!Number.isFinite(price)) return null
  return {
    symbol: bare(sym),
    price,
    dayLow: Number.isFinite(Number(m.regularMarketDayLow)) ? Number(m.regularMarketDayLow) : price,
    dayHigh: Number.isFinite(Number(m.regularMarketDayHigh)) ? Number(m.regularMarketDayHigh) : price,
    time: (Number(m.regularMarketTime) || 0) * 1000,
    currency: m.currency || 'IDR',
  }
}

/** Fetch quotes for bare symbols (e.g. ["BBCA","BBRI"]). Never throws — returns what it can. */
export async function fetchStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const wanted = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))]
  if (!wanted.length) return []
  const ySyms = wanted.map(toYahoo)

  // path 1: Apps Script proxy
  const webapp = sheetsTarget()
  if (webapp) {
    try {
      const url = `${webapp}${webapp.includes('?') ? '&' : '?'}action=quote&symbols=${encodeURIComponent(ySyms.join(','))}`
      const res = await fetch(url, { method: 'GET', redirect: 'follow' })
      if (res.ok) {
        const rows = (await res.json()) as (Partial<StockQuote> & { error?: string })[]
        const out = (Array.isArray(rows) ? rows : [])
          .filter((r) => r && !r.error && Number.isFinite(Number(r.price)))
          .map((r) => ({
            symbol: bare(String(r.symbol ?? '')),
            price: Number(r.price),
            dayLow: Number.isFinite(Number(r.dayLow)) ? Number(r.dayLow) : Number(r.price),
            dayHigh: Number.isFinite(Number(r.dayHigh)) ? Number(r.dayHigh) : Number(r.price),
            time: Number(r.time) || 0,
            currency: r.currency || 'IDR',
          }))
        if (out.length) return out
      }
    } catch {
      /* fall through to proxy */
    }
  }

  // path 2: public CORS proxy → Yahoo chart endpoint (one request per symbol)
  const results = await Promise.allSettled(
    ySyms.map(async (sym) => {
      const yurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`
      const res = await fetch(PROXY + encodeURIComponent(yurl))
      if (!res.ok) throw new Error(`quote ${sym} ${res.status}`)
      const data = await res.json()
      const meta = data?.chart?.result?.[0]?.meta as YahooMeta | undefined
      if (!meta) throw new Error(`quote ${sym} no meta`)
      return fromMeta(sym, meta)
    }),
  )
  return results
    .flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))
}
