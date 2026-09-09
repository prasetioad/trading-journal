// Live crypto prices from Binance public market data (no API key).
//
// Primary:  combined WebSocket miniTicker stream (sub-second).
// Fallback: REST polling of the CORS-enabled data mirror every few seconds —
//           kept running always, so prices still flow on networks that block
//           WSS (corp proxies, some sandboxes). WS ticks supersede poll ticks.
// PRD Non-Functional: crypto price < 1s (WS) / near-real-time (poll).

const WS_BASE = 'wss://stream.binance.com:9443/stream'
const REST_BASE = 'https://data-api.binance.vision/api/v3'
const POLL_MS = 5000

export type ConnState = 'idle' | 'connecting' | 'live' | 'polling' | 'reconnecting' | 'error'

export interface PriceFeedEvents {
  onTick: (pair: string, price: number) => void
  onState?: (s: ConnState) => void
}

const norm = (p: string) => p.trim().toUpperCase()

export class PriceFeed {
  private ws: WebSocket | null = null
  private pairs = new Set<string>()
  private events: PriceFeedEvents
  private backoff = 1000
  private stopped = false
  private wsConnected = false
  private wsFailures = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(events: PriceFeedEvents) {
    this.events = events
  }

  /** Replace the watched set. Also resumes the feed if it was stopped
   *  (React StrictMode mounts → unmounts → remounts with the same set). */
  setPairs(pairs: string[]) {
    const next = new Set(pairs.map(norm).filter(Boolean))
    const unchanged = sameSet(next, this.pairs)
    const wasStopped = this.stopped
    this.stopped = false
    this.pairs = next

    if (unchanged && !wasStopped) return

    if (!unchanged) this.wsFailures = 0 // new pair set → give WS another chance
    this.poll() // immediate snapshot
    this.ensurePolling()
    this.connectWs()
  }

  stop() {
    this.stopped = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
    this.ws?.close()
    this.ws = null
    this.events.onState?.('idle')
  }

  private emitState() {
    if (this.stopped) return this.events.onState?.('idle')
    if (this.wsConnected) return this.events.onState?.('live')
    if (this.pairs.size === 0) return this.events.onState?.('idle')
    this.events.onState?.('polling')
  }

  // ---- REST polling fallback ----

  private ensurePolling() {
    if (this.pollTimer || this.pairs.size === 0) return
    this.pollTimer = setInterval(() => this.poll(), POLL_MS)
  }

  private async poll() {
    const list = [...this.pairs]
    if (!list.length || this.stopped) return
    try {
      const url = `${REST_BASE}/ticker/price?symbols=${encodeURIComponent(JSON.stringify(list))}`
      const res = await fetch(url)
      if (!res.ok) return
      const rows: { symbol: string; price: string }[] = await res.json()
      for (const r of rows) {
        const p = Number(r.price)
        if (Number.isFinite(p)) this.events.onTick(r.symbol, p)
      }
      this.emitState()
    } catch {
      if (!this.wsConnected) this.events.onState?.('error')
    }
  }

  // ---- WebSocket (best effort) ----

  private connectWs() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.wsConnected = false

    const list = [...this.pairs]
    if (!list.length || this.stopped) {
      this.ws = null
      this.emitState()
      return
    }

    const streams = list.map((p) => `${p.toLowerCase()}@miniTicker`).join('/')
    let ws: WebSocket
    try {
      ws = new WebSocket(`${WS_BASE}?streams=${streams}`)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.wsConnected = true
      this.wsFailures = 0
      this.backoff = 1000
      this.emitState()
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string)
        const d = msg?.data
        if (d?.s && d?.c) this.events.onTick(String(d.s), Number(d.c))
      } catch {
        /* ignore malformed frame */
      }
    }
    ws.onerror = () => {
      /* onclose will follow */
    }
    ws.onclose = () => {
      const wasConnected = this.wsConnected
      this.wsConnected = false
      this.emitState() // -> falls back to 'polling'
      if (wasConnected) this.wsFailures = 0
      else this.wsFailures++
      // Networks that block WSS: after 2 straight failures, stop retrying and
      // rely on REST polling (retries again only when the watched set changes).
      if (!this.stopped && this.wsFailures < 2) this.scheduleReconnect()
    }
  }

  private scheduleReconnect() {
    this.reconnectTimer = setTimeout(() => this.connectWs(), this.backoff)
    this.backoff = Math.min(this.backoff * 2, 60_000)
  }
}

function sameSet(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false
  for (const x of a) if (!b.has(x)) return false
  return true
}
