// Server-side copy of the crossing rules + prompt (mirror of src/lib/verify.ts
// and src/lib/ai/prompt.ts). Kept as a copy because Edge Functions run on Deno
// with their own import graph; keep the two in sync when either changes.

export type Dir = 'long' | 'short'

export function tradeDirection(entry: number, tp: number): Dir {
  return tp >= entry ? 'long' : 'short'
}

export function checkTrade(
  t: { direction: Dir; take_profit: number; stop_loss: number },
  price: number,
): { exitPrice: number; reason: 'tp' | 'sl' } | null {
  if (t.direction === 'long') {
    if (price >= t.take_profit) return { exitPrice: t.take_profit, reason: 'tp' }
    if (price <= t.stop_loss) return { exitPrice: t.stop_loss, reason: 'sl' }
  } else {
    if (price <= t.take_profit) return { exitPrice: t.take_profit, reason: 'tp' }
    if (price >= t.stop_loss) return { exitPrice: t.stop_loss, reason: 'sl' }
  }
  return null
}

export function checkAnalysis(
  a: { target_price: number; invalidation_price: number },
  price: number,
): 'success' | 'fail' | null {
  const targetUp = a.target_price >= a.invalidation_price
  if (targetUp) {
    if (price >= a.target_price) return 'success'
    if (price <= a.invalidation_price) return 'fail'
  } else {
    if (price <= a.target_price) return 'success'
    if (price >= a.invalidation_price) return 'fail'
  }
  return null
}

export function realizedPnl(
  t: { entry_price: number; size_amount: number; direction: Dir },
  exit: number,
): number {
  if (!t.entry_price) return 0
  const pct = (exit - t.entry_price) / t.entry_price
  return t.size_amount * pct * (t.direction === 'long' ? 1 : -1)
}

export function realizedRR(
  t: { entry_price: number; stop_loss: number; direction: Dir },
  exit: number,
): number | null {
  const risk = Math.abs(t.entry_price - t.stop_loss)
  if (!risk) return null
  const reward = (exit - t.entry_price) * (t.direction === 'long' ? 1 : -1)
  return reward / risk
}

/** Binance last price for a set of USDT pairs. */
export async function binancePrices(pairs: string[]): Promise<Record<string, number>> {
  if (!pairs.length) return {}
  const url =
    'https://data-api.binance.vision/api/v3/ticker/price?symbols=' +
    encodeURIComponent(JSON.stringify(pairs))
  const res = await fetch(url)
  if (!res.ok) return {}
  const rows: { symbol: string; price: string }[] = await res.json()
  return Object.fromEntries(rows.map((r) => [r.symbol, Number(r.price)]))
}

export const INSIGHT_SYSTEM = `Kamu adalah "AI Executive Trading Coach"... (salin dari src/lib/ai/prompt.ts INSIGHT_SYSTEM)`
