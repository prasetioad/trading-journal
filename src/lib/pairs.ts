// Crypto pair list for the journal pair picker — avoids typos.
// Curated fallback (always available offline) + a live Binance symbol list that
// is fetched once and cached in localStorage for 24h.
import { fetchSpotSymbols } from './binance'

/** ~70 of the most-traded USDT spot pairs — the offline default. */
export const CRYPTO_PAIRS: string[] = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT',
  'AVAXUSDT', 'LINKUSDT', 'DOTUSDT', 'MATICUSDT', 'POLUSDT', 'LTCUSDT', 'BCHUSDT', 'NEARUSDT',
  'UNIUSDT', 'ICPUSDT', 'APTUSDT', 'FILUSDT', 'ETCUSDT', 'ATOMUSDT', 'XLMUSDT', 'HBARUSDT',
  'ARBUSDT', 'OPUSDT', 'INJUSDT', 'SUIUSDT', 'SEIUSDT', 'TIAUSDT', 'RUNEUSDT', 'AAVEUSDT',
  'MKRUSDT', 'RNDRUSDT', 'RENDERUSDT', 'IMXUSDT', 'GRTUSDT', 'FTMUSDT', 'ALGOUSDT', 'FLOWUSDT',
  'SANDUSDT', 'MANAUSDT', 'AXSUSDT', 'GALAUSDT', 'CHZUSDT', 'APEUSDT', 'LDOUSDT', 'CRVUSDT',
  'SNXUSDT', 'COMPUSDT', 'DYDXUSDT', 'GMXUSDT', 'PENDLEUSDT', 'JUPUSDT', 'PYTHUSDT', 'WLDUSDT',
  'ORDIUSDT', 'STXUSDT', 'FETUSDT', 'AGIXUSDT', 'ARKMUSDT', 'BLURUSDT', 'ENSUSDT', '1INCHUSDT',
  'PEPEUSDT', 'SHIBUSDT', 'FLOKIUSDT', 'BONKUSDT', 'WIFUSDT', 'BOMEUSDT',
  'BTCUSDC', 'ETHUSDC', 'SOLUSDC',
]

const KEY = 'tj.cryptoPairs.v1'
const TTL = 24 * 60 * 60 * 1000

interface Cache {
  at: number
  pairs: string[]
}

/** Merge the live symbol list into the cache; falls back to the curated list. */
export async function loadCryptoPairs(): Promise<string[]> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const c = JSON.parse(raw) as Cache
      if (Date.now() - c.at < TTL && Array.isArray(c.pairs) && c.pairs.length) {
        return mergeCurated(c.pairs)
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const live = await fetchSpotSymbols()
    if (live.length) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), pairs: live } satisfies Cache))
      } catch {
        /* ignore */
      }
      return mergeCurated(live)
    }
  } catch {
    /* offline — fall through */
  }
  return [...CRYPTO_PAIRS]
}

function mergeCurated(list: string[]): string[] {
  const set = new Set(list)
  for (const p of CRYPTO_PAIRS) set.add(p)
  return [...set].sort()
}

/** Is this a recognised crypto pair (curated list — sync, no network)? */
export function isCuratedPair(pair: string): boolean {
  return CRYPTO_PAIRS.includes(pair.trim().toUpperCase())
}
