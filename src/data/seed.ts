// Demo dataset for the prototype. Mirrors realistic trader behaviour: a couple of
// strategies mid-sample, disciplined winners, a few emotional leaks, a revenge
// sequence, and enough time/setup/market-condition spread for the analytics
// engine (src/lib/analytics.ts) and behavioral rule engine (src/lib/rules.ts).
import type {
  Analysis,
  JournalEntry,
  MarketCondition,
  Psychology,
  Strategy,
  TradingPlan,
} from '../types'
import { direction, outcomeOf, realizedPnl, realizedRR } from '../lib/finance'

const S_BREAKOUT = 'seed-strat-breakout'
const S_SND = 'seed-strat-snd'
const S_EMA = 'seed-strat-ema'

function daysAgo(n: number, hour = 15, minute = 12) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function seedStrategies(): Strategy[] {
  return [
    {
      id: S_BREAKOUT,
      name: 'Breakout Retest',
      description:
        'Entry saat harga break level kunci lalu retest sebagai support/resistance baru. Konfirmasi: volume naik + close di atas level. Exit: SL di bawah retest, TP di swing high berikutnya.',
      target_sample_size: 20,
      status: 'testing',
      created_at: daysAgo(40),
      updated_at: daysAgo(2),
    },
    {
      id: S_SND,
      name: 'Supply-Demand Reversal',
      description:
        'Entry di zona supply/demand H4 yang belum ter-mitigasi. Konfirmasi: rejection wick + BOS di LTF. SL di luar zona, TP di zona berlawanan terdekat.',
      target_sample_size: 20,
      status: 'testing',
      created_at: daysAgo(35),
      updated_at: daysAgo(3),
    },
    {
      id: S_EMA,
      name: 'Trend Following EMA',
      description:
        'Hanya trade searah EMA200. Entry pullback ke EMA20/50 saat struktur HH-HL. SL di HL terakhir, TP trailing di bawah EMA20.',
      target_sample_size: 15,
      status: 'archived',
      created_at: daysAgo(90),
      updated_at: daysAgo(20),
    },
  ]
}

interface RawTrade {
  d: number
  h?: number // entry hour (local) — drives session spread
  m?: number // entry minute
  closeMin?: number // minutes after entry the position closed (overrides default)
  mode?: 'backtest' // omit => live
  asset: 'crypto' | 'stock'
  pair: string
  strat: string | null
  followed: boolean
  size: number
  cur: 'IDR' | 'USD'
  entry: number
  planned?: number // planned entry price (for late-entry detection)
  tp: number
  sl: number
  psych: Psychology
  tags?: string[]
  mc?: MarketCondition
  conf?: number
  risk?: number
  mistakes?: string[]
  why: string
  exit?: number // present => closed
  open?: boolean
}

function build(r: RawTrade): JournalEntry {
  const hour = r.h ?? 9
  const minute = r.m ?? 12
  const entryIso = daysAgo(r.d, hour, minute)
  const base: JournalEntry = {
    id: `seed-tr-${r.d}-${hour}-${minute}-${r.pair}`,
    asset_type: r.asset,
    pair: r.pair,
    strategy_id: r.strat,
    followed_plan: r.followed,
    size_amount: r.size,
    size_currency: r.cur,
    entry_price: r.entry,
    take_profit: r.tp,
    stop_loss: r.sl,
    direction: direction(r.entry, r.tp),
    exit_price: null,
    realized_pnl: null,
    realized_rr: null,
    status: 'open',
    outcome: null,
    mode: r.mode ?? 'live',
    psychology: r.psych,
    reasoning: r.why,
    analyzed_by_ai: false,
    analyzed_at: null,
    closed_at: null,
    created_at: entryIso,
    entry_at: entryIso,
    planned_entry: r.planned ?? null,
    setup_tags: r.tags ?? [],
    market_condition: r.mc ?? null,
    confidence: r.conf ?? null,
    risk_pct: r.risk ?? null,
    screenshot_ref: null,
    mistakes: r.mistakes ?? [],
  }
  if (r.open || r.exit == null) return base
  const pnl = realizedPnl(base, r.exit)
  const closedIso =
    r.closeMin != null
      ? new Date(new Date(entryIso).getTime() + r.closeMin * 60000).toISOString()
      : daysAgo(r.d, Math.min(23, hour + 4), minute)
  return {
    ...base,
    status: 'closed',
    exit_price: r.exit,
    realized_pnl: pnl,
    realized_rr: realizedRR(base, r.exit),
    outcome: outcomeOf(pnl),
    analyzed_by_ai: r.d > 3,
    analyzed_at: r.d > 3 ? daysAgo(r.d - 1, 17) : null,
    closed_at: closedIso,
  }
}

export function seedJournal(): JournalEntry[] {
  const raw: RawTrade[] = [
    // --- Breakout Retest: disciplined sample in progress ---
    { d: 30, h: 14, asset: 'crypto', pair: 'BTCUSDT', strat: S_BREAKOUT, followed: true, size: 1000, cur: 'USD', entry: 61000, tp: 64000, sl: 60000, psych: 'Percaya diri', tags: ['Breakout', 'Retest'], mc: 'Trending', conf: 8, risk: 1, why: 'Break weekly resistance 60.8k, retest bersih, volume ekspansi.', exit: 64000 },
    { d: 28, h: 9, asset: 'crypto', pair: 'ETHUSDT', strat: S_BREAKOUT, followed: true, size: 800, cur: 'USD', entry: 3400, tp: 3600, sl: 3320, psych: 'Sabar', tags: ['Breakout', 'Retest'], mc: 'Trending', conf: 7, risk: 1, why: 'Retest 3.4k after range break, higher low intact.', exit: 3320 },
    { d: 25, h: 3, asset: 'stock', pair: 'BBCA', strat: S_BREAKOUT, followed: true, size: 15000000, cur: 'IDR', entry: 9700, tp: 10100, sl: 9575, psych: 'Netral', tags: ['Breakout'], mc: 'Trending', conf: 7, risk: 1.2, why: 'Break ATH 9.675, retest dengan volume tipis tapi valid.', exit: 10100 },
    { d: 22, h: 16, asset: 'crypto', pair: 'SOLUSDT', strat: S_BREAKOUT, followed: true, size: 600, cur: 'USD', entry: 145, tp: 158, sl: 140, psych: 'Percaya diri', tags: ['Breakout', 'Retest'], mc: 'Trending', conf: 8, risk: 1, why: 'Descending resistance break + retest, target swing high.', exit: 152 },
    { d: 18, h: 20, asset: 'crypto', pair: 'BTCUSDT', strat: S_BREAKOUT, followed: false, size: 1500, cur: 'USD', entry: 66000, planned: 65200, tp: 68000, sl: 65200, psych: 'FOMO', tags: ['Breakout'], mc: 'High volatility', conf: 5, risk: 2.3, mistakes: ['Entry terlalu dini', 'Size kegedean'], why: 'Belum retest tapi takut ketinggalan candle besar, entry di tengah range.', exit: 65200 },
    { d: 14, h: 4, asset: 'stock', pair: 'BBRI', strat: S_BREAKOUT, followed: true, size: 12000000, cur: 'IDR', entry: 4900, tp: 5150, sl: 4820, psych: 'Sabar', tags: ['Breakout', 'Reversal'], mc: 'Trending', conf: 7, risk: 1, why: 'Retest neckline inverse H&S, konfirmasi close H4.', exit: 5150 },
    { d: 10, h: 10, asset: 'crypto', pair: 'ETHUSDT', strat: S_BREAKOUT, followed: true, size: 900, cur: 'USD', entry: 3550, tp: 3750, sl: 3470, psych: 'Netral', tags: ['Breakout', 'Retest'], mc: 'Ranging', conf: 6, risk: 1, why: 'Retest 3.55k breakout, SL di bawah struktur.', exit: 3470 },
    { d: 6, h: 15, asset: 'crypto', pair: 'SOLUSDT', strat: S_BREAKOUT, followed: true, size: 700, cur: 'USD', entry: 150, tp: 165, sl: 144, psych: 'Percaya diri', tags: ['Breakout'], mc: 'Trending', conf: 8, risk: 1, mistakes: ['Cut profit kecepetan'], why: 'Break konsolidasi mingguan, retest cepat, ambil sebagian di 158.', exit: 158 },
    { d: 2, h: 8, asset: 'crypto', pair: 'BTCUSDT', strat: S_BREAKOUT, followed: true, size: 1200, cur: 'USD', entry: 63000, tp: 66500, sl: 61800, psych: 'Sabar', tags: ['Breakout', 'Retest'], mc: 'Trending', conf: 9, risk: 1, why: 'Retest range high, R:R > 1:2.5, tunggu konfirmasi 4H.', exit: 66500 },
    { d: 1, h: 3, asset: 'stock', pair: 'TLKM', strat: S_BREAKOUT, followed: true, size: 10000000, cur: 'IDR', entry: 3150, tp: 3320, sl: 3080, psych: 'Netral', tags: ['Breakout', 'Reversal'], mc: 'Ranging', conf: 6, risk: 1, why: 'Break downtrend line, retest sebagai support.', open: true },

    // --- Supply-Demand Reversal: rougher, some emotional leaks + revenge sequence ---
    { d: 27, h: 9, asset: 'crypto', pair: 'BNBUSDT', strat: S_SND, followed: true, size: 500, cur: 'USD', entry: 560, tp: 600, sl: 545, psych: 'Ragu-ragu', tags: ['Supply/Demand', 'Reversal'], mc: 'Ranging', conf: 5, risk: 1, why: 'Demand H4 belum mitigasi, rejection wick jelas.', exit: 600 },
    // revenge #1 — loss then immediate re-entry, size up, no confirmation
    { d: 24, h: 12, asset: 'crypto', pair: 'ETHUSDT', strat: S_SND, followed: false, size: 1000, cur: 'USD', entry: 3300, tp: 3450, sl: 3255, psych: 'Balas dendam', tags: ['Supply/Demand'], mc: 'High volatility', conf: 3, risk: 2.6, mistakes: ['Tanpa konfirmasi', 'Size kegedean', 'Overtrading'], why: 'Baru loss di trade sebelumnya, langsung masuk lagi tanpa BOS.', exit: 3255 },
    { d: 21, h: 4, asset: 'stock', pair: 'ASII', strat: S_SND, followed: true, size: 8000000, cur: 'IDR', entry: 5100, tp: 5400, sl: 4980, psych: 'Sabar', tags: ['Supply/Demand'], mc: 'Ranging', conf: 6, risk: 1, why: 'Supply weekly, entry di zona, TP di demand bawah.', exit: 4980 },
    { d: 17, h: 13, asset: 'crypto', pair: 'BTCUSDT', strat: S_SND, followed: false, size: 2000, cur: 'USD', entry: 64500, tp: 66000, sl: 63800, psych: 'FOMO', tags: ['Supply/Demand'], mc: 'High volatility', conf: 4, risk: 2.8, mistakes: ['Melawan trend', 'Size kegedean'], why: 'Lihat orang lain profit di TF kecil, ikut masuk padahal bukan zona saya.', exit: 63800 },
    { d: 13, h: 18, asset: 'crypto', pair: 'SOLUSDT', strat: S_SND, followed: true, size: 600, cur: 'USD', entry: 155, tp: 172, sl: 148, psych: 'Percaya diri', tags: ['Supply/Demand', 'Reversal'], mc: 'Trending', conf: 8, risk: 1, why: 'Demand daily fresh, konfirmasi BOS M15.', exit: 172 },
    { d: 9, h: 10, asset: 'crypto', pair: 'ETHUSDT', strat: S_SND, followed: true, size: 800, cur: 'USD', entry: 3600, tp: 3820, sl: 3520, psych: 'Sabar', tags: ['Supply/Demand'], mc: 'Trending', conf: 7, risk: 1, mistakes: ['Cut profit kecepetan'], why: 'Demand H4, rejection + BOS, tahan sampai TP1.', exit: 3700 },
    // revenge #2 — losing streak, size doubled, no exit plan
    { d: 5, h: 12, asset: 'crypto', pair: 'BNBUSDT', strat: S_SND, followed: false, size: 1200, cur: 'USD', entry: 590, tp: 620, sl: 575, psych: 'Balas dendam', tags: ['Supply/Demand'], mc: 'High volatility', conf: 2, risk: 3.1, mistakes: ['Size kegedean', 'Tanpa konfirmasi', 'Overtrading'], why: 'Revenge setelah SL beruntun, size digedein 2x, tanpa rencana exit.', exit: 575 },
    { d: 3, h: 3, asset: 'stock', pair: 'BBCA', strat: S_SND, followed: true, size: 9000000, cur: 'IDR', entry: 10200, tp: 10600, sl: 10050, psych: 'Netral', tags: ['Supply/Demand'], mc: 'Ranging', conf: 6, risk: 1, why: 'Demand H4 di 10.2k, target supply 10.6k.', exit: 10600 },
    { d: 1, h: 6, asset: 'crypto', pair: 'BTCUSDT', strat: S_SND, followed: true, size: 800, cur: 'USD', entry: 72000, tp: 135000, sl: 55000, psych: 'Sabar', tags: ['Supply/Demand', 'Trend Following'], mc: 'Trending', conf: 7, risk: 1, why: 'Demand weekly, posisi swing jangka panjang — target siklus, SL di bawah struktur makro.', open: true },
    { d: 1, h: 19, asset: 'crypto', pair: 'ETHUSDT', strat: S_BREAKOUT, followed: true, size: 500, cur: 'USD', entry: 2600, tp: 5200, sl: 1900, psych: 'Netral', tags: ['Breakout', 'Trend Following'], mc: 'Trending', conf: 6, risk: 1, why: 'Retest range besar, hold swing. TP di ATH lama, SL di bawah demand makro.', open: true },

    // --- "Tilt day" (d-4): loss → intraday revenge sequence + overtrading ---
    { d: 4, h: 9, m: 0, closeMin: 35, asset: 'crypto', pair: 'BTCUSDT', strat: S_BREAKOUT, followed: true, size: 1000, cur: 'USD', entry: 63500, tp: 65000, sl: 62800, psych: 'Sabar', tags: ['Breakout'], mc: 'Ranging', conf: 6, risk: 1, why: 'Retest range, konfirmasi lemah, kena SL.', exit: 62800 },
    { d: 4, h: 9, m: 45, closeMin: 20, asset: 'crypto', pair: 'ETHUSDT', strat: S_SND, followed: false, size: 2500, cur: 'USD', entry: 3500, tp: 3560, sl: 3460, psych: 'Balas dendam', tags: ['Supply/Demand'], mc: 'High volatility', conf: 3, risk: 2.8, mistakes: ['Size kegedean', 'Tanpa konfirmasi', 'Overtrading'], why: 'Langsung balas 10 menit setelah SL, size 2.5x, tanpa setup.', exit: 3460 },
    { d: 4, h: 10, m: 10, closeMin: 15, asset: 'crypto', pair: 'BTCUSDT', strat: S_SND, followed: false, size: 3000, cur: 'USD', entry: 62900, tp: 63400, sl: 62600, psych: 'Balas dendam', tags: ['Supply/Demand'], mc: 'High volatility', conf: 2, risk: 3.0, mistakes: ['Size kegedean', 'Overtrading'], why: 'Revenge kedua, size dinaikkan lagi, scalping panik.', exit: 62600 },
    { d: 4, h: 10, m: 40, closeMin: 30, asset: 'crypto', pair: 'SOLUSDT', strat: S_SND, followed: false, size: 1500, cur: 'USD', entry: 150, tp: 154, sl: 147, psych: 'FOMO', tags: ['Supply/Demand'], mc: 'High volatility', conf: 3, risk: 1.8, mistakes: ['Overtrading'], why: 'Masih di depan layar, paksa entry keempat.', exit: 147 },
    { d: 4, h: 11, m: 20, closeMin: 25, asset: 'crypto', pair: 'ETHUSDT', strat: null, followed: false, size: 800, cur: 'USD', entry: 3480, tp: 3520, sl: 3450, psych: 'Serakah', tags: ['News Play'], mc: 'High volatility', conf: 3, risk: 1.5, mistakes: ['Overtrading'], why: 'Trade kelima hari itu, seharusnya sudah stop.', exit: 3520 },

    // --- Archived EMA strategy: historical ---
    { d: 60, h: 11, asset: 'crypto', pair: 'BTCUSDT', strat: S_EMA, followed: true, size: 1000, cur: 'USD', entry: 52000, tp: 56000, sl: 50500, psych: 'Percaya diri', tags: ['Trend Following', 'Pullback'], mc: 'Trending', conf: 8, risk: 1, why: 'Pullback EMA50 dalam uptrend, HH-HL utuh.', exit: 56000 },
    { d: 55, h: 9, asset: 'crypto', pair: 'ETHUSDT', strat: S_EMA, followed: true, size: 800, cur: 'USD', entry: 2900, tp: 3100, sl: 2830, psych: 'Sabar', tags: ['Trend Following', 'Pullback'], mc: 'Trending', conf: 7, risk: 1, why: 'Pullback EMA20, lanjut trend.', exit: 2830 },
    { d: 48, h: 16, asset: 'crypto', pair: 'SOLUSDT', strat: S_EMA, followed: true, size: 500, cur: 'USD', entry: 110, tp: 128, sl: 104, psych: 'Netral', tags: ['Trend Following', 'Pullback'], mc: 'Trending', conf: 7, risk: 1, why: 'Trend kuat, pullback dangkal ke EMA20.', exit: 128 },

    // --- Experiment / no strategy ---
    { d: 12, h: 13, asset: 'crypto', pair: 'DOGEUSDT', strat: null, followed: false, size: 300, cur: 'USD', entry: 0.16, tp: 0.19, sl: 0.15, psych: 'Serakah', tags: ['News Play'], mc: 'News event', conf: 3, risk: 1.5, mistakes: ['Tanpa konfirmasi'], why: 'Eksperimen ikut hype meme, tanpa setup jelas.', exit: 0.15 },
    { d: 7, h: 14, asset: 'crypto', pair: 'PEPEUSDT', strat: null, followed: false, size: 250, cur: 'USD', entry: 0.0000102, tp: 0.0000125, sl: 0.0000098, psych: 'FOMO', tags: ['News Play'], mc: 'News event', conf: 2, risk: 1.5, mistakes: ['Abaikan news', 'Tanpa konfirmasi'], why: 'FOMO listing news, masuk market order.', exit: 0.0000098 },

    // --- Backtest Lab: extra Breakout Retest samples on historical data ---
    // (mode:'backtest' → feeds ONLY the Strategy League Table, not P/L/dashboard)
    { d: 46, mode: 'backtest', asset: 'crypto', pair: 'BTCUSDT', strat: S_BREAKOUT, followed: true, size: 1000, cur: 'USD', entry: 58000, tp: 61500, sl: 56800, psych: 'Netral', tags: ['Breakout', 'Retest'], mc: 'Trending', why: 'Backtest: break 57.8k, retest bersih.', exit: 61500 },
    { d: 44, mode: 'backtest', asset: 'crypto', pair: 'ETHUSDT', strat: S_BREAKOUT, followed: true, size: 800, cur: 'USD', entry: 3100, tp: 3280, sl: 3030, psych: 'Netral', tags: ['Breakout'], mc: 'Trending', why: 'Backtest: retest range high 3.1k.', exit: 3030 },
    { d: 42, mode: 'backtest', asset: 'crypto', pair: 'SOLUSDT', strat: S_BREAKOUT, followed: true, size: 600, cur: 'USD', entry: 132, tp: 148, sl: 126, psych: 'Netral', tags: ['Breakout', 'Retest'], mc: 'Trending', why: 'Backtest: descending resistance break.', exit: 148 },
    { d: 39, mode: 'backtest', asset: 'stock', pair: 'BBCA', strat: S_BREAKOUT, followed: true, size: 15000000, cur: 'IDR', entry: 9200, tp: 9600, sl: 9060, psych: 'Netral', tags: ['Breakout'], mc: 'Trending', why: 'Backtest: break konsolidasi, volume valid.', exit: 9600 },
    { d: 37, mode: 'backtest', asset: 'crypto', pair: 'BTCUSDT', strat: S_BREAKOUT, followed: true, size: 1000, cur: 'USD', entry: 60500, tp: 63000, sl: 59400, psych: 'Netral', tags: ['Breakout', 'Retest'], mc: 'Ranging', why: 'Backtest: retest gagal, fakeout.', exit: 59400 },
    { d: 34, mode: 'backtest', asset: 'crypto', pair: 'BNBUSDT', strat: S_BREAKOUT, followed: true, size: 500, cur: 'USD', entry: 520, tp: 560, sl: 505, psych: 'Netral', tags: ['Breakout'], mc: 'Trending', why: 'Backtest: break weekly, retest cepat.', exit: 560 },
    { d: 31, mode: 'backtest', asset: 'crypto', pair: 'ETHUSDT', strat: S_BREAKOUT, followed: true, size: 800, cur: 'USD', entry: 3250, tp: 3450, sl: 3170, psych: 'Netral', tags: ['Breakout', 'Retest'], mc: 'Trending', why: 'Backtest: retest neckline, R:R 2.5.', exit: 3450 },
    { d: 29, mode: 'backtest', asset: 'stock', pair: 'BBRI', strat: S_BREAKOUT, followed: true, size: 12000000, cur: 'IDR', entry: 4650, tp: 4900, sl: 4560, psych: 'Netral', tags: ['Breakout'], mc: 'Ranging', why: 'Backtest: break downtrend line, retest.', exit: 4560 },
  ]
  return raw.map(build)
}

export function seedPlans(): TradingPlan[] {
  const today = new Date().toISOString().slice(0, 10)
  const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  return [
    {
      id: 'seed-plan-today',
      plan_date: today,
      bias: 'bullish',
      key_levels: [63000, 66500, 72000],
      allowed_setups: ['Breakout', 'Retest'],
      max_trades: 3,
      max_daily_loss_r: 2,
      no_trade_rules: ['Major news dalam 30 menit', 'Market choppy / tanpa struktur'],
      notes: 'Fokus retest range high BTC. Skip bila R:R < 1:1.5.',
      created_at: today + 'T01:00:00.000Z',
    },
    {
      id: 'seed-plan-yday',
      plan_date: yday,
      bias: 'neutral',
      key_levels: [3150, 3320],
      allowed_setups: ['Breakout'],
      max_trades: 2,
      max_daily_loss_r: 1.5,
      no_trade_rules: ['Tanpa konfirmasi H4'],
      notes: 'Sesi tenang, sabar menunggu breakout downtrend line.',
      created_at: yday + 'T01:00:00.000Z',
    },
  ]
}

export function seedAnalyses(): Analysis[] {
  return [
    {
      id: 'seed-an-1',
      pair: 'BTCUSDT',
      asset_type: 'crypto',
      bias: 'bullish',
      support: 74000,
      resistance: 100000,
      target_price: 150000,
      invalidation_price: 52000,
      technique_tags: ['Market Structure', 'Demand Zone', 'Fibonacci'],
      notes: 'Selama di atas 52k struktur makro masih bullish. Target ekspansi siklus di 150k.',
      status: 'pending',
      resolved_at: null,
      analyzed_by_ai: false,
      created_at: daysAgo(2, 10),
    },
    {
      id: 'seed-an-2',
      pair: 'BBRI',
      asset_type: 'stock',
      bias: 'bullish',
      support: 4800,
      resistance: 5150,
      target_price: 5400,
      invalidation_price: 4720,
      technique_tags: ['Inverse H&S', 'Volume'],
      notes: 'Neckline 4.9k, target measured move 5.4k.',
      status: 'success',
      resolved_at: daysAgo(9, 15),
      analyzed_by_ai: true,
      created_at: daysAgo(16, 10),
    },
    {
      id: 'seed-an-3',
      pair: 'ETHUSDT',
      asset_type: 'crypto',
      bias: 'bearish',
      support: 3200,
      resistance: 3600,
      target_price: 3050,
      invalidation_price: 3660,
      technique_tags: ['Supply Zone', 'RSI Divergence'],
      notes: 'Bearish divergence H4 di supply 3.6k. Invalidation jika close di atas 3.66k.',
      status: 'fail',
      resolved_at: daysAgo(6, 12),
      analyzed_by_ai: true,
      created_at: daysAgo(12, 10),
    },
    {
      id: 'seed-an-4',
      pair: 'SOLUSDT',
      asset_type: 'crypto',
      bias: 'bullish',
      support: 95,
      resistance: 260,
      target_price: 400,
      invalidation_price: 60,
      technique_tags: ['Breakout', 'Trend Following'],
      notes: 'Selama bertahan di atas 60, skenario ekspansi menuju 400 masih valid.',
      status: 'pending',
      resolved_at: null,
      analyzed_by_ai: false,
      created_at: daysAgo(1, 11),
    },
  ]
}
