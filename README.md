# Trading Journal & Analysis — Cockpit

Implementasi PRD v2.1 **+ Roadmap V2** ("Find your trading edge" — analitik
performa, behavioral engine, AI coach). Frontend React + Vite + TS + Tailwind,
data lokal (localStorage), harga crypto **live dari Binance**, backend Supabase
disiapkan di [`/supabase`](./supabase).
Peta pengerjaan: [ROADMAP.md](./ROADMAP.md) · [roadmapv2.md](./roadmapv2.md) ·
model data: [docs/data-model.md](./docs/data-model.md).

`npm test` menjalankan unit test (Vitest) untuk `lib/finance`, `analytics`,
`rules`, `plan`, `search`, `csv`.

## Menjalankan

> **Butuh Node ≥ 20.19.** Repo ini punya `.nvmrc`. Kalau `npm run dev` gagal
> dengan error `styleText` / versi Node, shell-mu masih di Node lama:

```bash
nvm use            # baca .nvmrc → Node 20  (nvm install 20 kalau belum ada)
npm install
npm run dev        # http://localhost:5173
```

`npm run build` (typecheck + bundle) · `npm run typecheck` · `npm run lint` · `npm test`.

Data demo di-seed otomatis. Tombol **Reset data demo** / **Kosongkan data** di sidebar.
Opsional: salin `.env.example` → `.env.local` untuk mengaktifkan Supabase / Claude API.

## Status fitur (ringkas)

| Modul PRD | Status |
|---|---|
| **1 · Strategy Playbook** — CRUD, Sample Size Tracker, status testing/active/archived | ✅ |
| **2 · Trading Journal** — form lengkap, Planned R:R live, lifecycle open→closed, Realized P/L & R:R | ✅ |
| **2 · Verifikasi otomatis crypto** — live price Binance, auto SL/TP, auto-resolve prediksi, unrealized P/L | ✅ |
| **3 · My Analysis / Prediction** — CRUD, target vs invalidation, live price + % ke target | ✅ |
| **4 · Dashboard** — AI Briefing, Strategy League (Expectancy), Emotional Leak, Discipline Gauge, R:R Gap, Equity Curve, Audit Psikologi, Live Positions | ✅ |
| **5 · AI Daily Insight** — prompt batch + engine pluggable (Claude API / deterministik), tombol Regenerate | 🟡 client jadi; Edge Function scaffold |
| **4 · Live saham IDX** | 🟡 delayed via Yahoo (proxy Apps Script / CORS-proxy); auto SL/TP pakai range harian — `docs/google-sheets-storage.md` |
| **6 · Screener** | ⬜ ditunda (Non-Goal PRD) |
| **7 · Polish** — export **& import** CSV, toast, mobile drawer | ✅ (PDF ⬜) |

### Roadmap V2 — Track A (fitur, selesai)

| Area | Status |
|---|---|
| A0 · Data model extension (entry_at, setup_tags, market_condition, confidence, risk_pct, screenshot, mistakes) + `trading_plans` | ✅ |
| A1 · `lib/analytics.ts` — per jam / sesi / hari / setup / market condition, streaks, drawdown, Trading DNA | ✅ |
| A2 · `lib/rules.ts` — behavioral flags (revenge, risk-creep, overtrading, late-entry, cut-profit-early), discipline per-trade, `autoInsights()` | ✅ |
| A3 · Vitest + 36 unit tests | ✅ |
| A4 · **Insights** page — auto Edge/Weakness/Behavioral/Time/Risk, Weekly Review, charts & tables, Trading DNA | ✅ |
| A5 · **Trading Plan** module — plan harian + Plan vs Actual | ✅ |
| A6 · Dashboard — Trading Calendar + Streak/Drawdown | ✅ |
| A7 · Natural-language journal search (`lib/search.ts`) | ✅ |
| A8 · Trade replay | ❌ dibatalkan |
| A9 · Screenshot upload (client compress) + lightbox | ✅ |
| A10 · CSV import | ✅ |
| A11 · Journal editable (`updateTrade`, incl. exit-price fix) + searchable crypto pair picker + pattern-view list (per-trade discipline, behavior chips, sessions, sort, group-by-day) | ✅ |
| A12 · Temporary storage = Google Sheets (Apps Script Web App), localStorage as cache — [docs/google-sheets-storage.md](./docs/google-sheets-storage.md) | ✅ |

**Track B (butuh kredensial user):** flip ke Supabase + Auth/RLS, screenshot →
Storage, deploy Edge Function `ai-daily`, provider data IDX. Lihat
[roadmapv2.md](./roadmapv2.md) & [MIGRATION-SUPABASE.md](./MIGRATION-SUPABASE.md).

## Live price feed

`src/lib/binance.ts`: WebSocket `stream.binance.com` (sub-detik) dengan **fallback
REST poll** ke `data-api.binance.vision` tiap 5 dtk (CORS-enabled) — prices tetap
mengalir di jaringan yang memblok WSS. Toggle **Auto SL/TP** di header
mengaktifkan `src/store/prices.tsx` yang menutup trade / resolve prediksi otomatis
saat harga menyentuh level, lalu memunculkan toast.

## Arsitektur

```
src/
  types.ts                 Domain model — cermin skema Supabase
  lib/
    finance.ts             R:R, Expectancy, Profit Factor, Discipline, Leak,
                           Equity Curve, Psychology audit, R:R gap  (fungsi murni)
    analytics.ts           Per jam/sesi/hari/setup/market, streaks, drawdown, Trading DNA
    rules.ts               Behavioral flags + discipline per-trade + autoInsights()
    plan.ts                planVsActual() — plan harian vs eksekusi
    search.ts              Parser natural-language → filter jurnal
    fx.ts                   Normalisasi multi-currency → IDR untuk agregat portofolio
    verify.ts               Aturan crossing SL/TP & target/invalidation (murni)
    binance.ts              Live price feed (WS + REST fallback) + fetchSpotSymbols
    pairs.ts                Crypto pair list (curated + live Binance, cached) for the picker
    stocks.ts               Delayed IDX quotes (Yahoo via Apps Script / CORS proxy)
    storage.ts             Screenshot: compress client → data URL (seam ke Supabase Storage)
    csv.ts                  Export + import CSV jurnal & analisa
    ai/prompt.ts            Prompt batch harian (dependency-free, dishare ke Edge Fn)
    ai/engine.ts            Engine pluggable: Claude API bila ada key, else deterministik
    ai.ts                   Briefing + Weekly Review deterministik (fallback, biaya $0)
    supabase.ts             Client (aktif hanya bila env terisi)
    format.ts               Formatter uang / angka / R:R / tanggal
  lib/
    sheets.ts               Google Sheets storage (Apps Script Web App) — readAll/writeAll
  store/
    repository.ts           localStorage cache + migrate() backfill V2
    repository.supabase.ts  CRUD async row-level (siap, belum di-wire — MIGRATION-SUPABASE.md)
    store.tsx               Context + semua action (trades, plans) + Sheets sync (hybrid)
    prices.tsx              PricesProvider + auto-verify + toast
google-apps-script/Code.gs  Web App backend untuk Google Sheets (tempel & deploy)
  components/ui/            Card, Badge, ProgressBar, Gauge, StatTile, Modal, Toast, form
  features/{playbook,journal,analysis,dashboard,insights,plan}/
  pages/                    Dashboard, Insights, Playbook, Journal, Plan, Analysis
  test/factory.ts          Pembuat JournalEntry untuk unit test
supabase/
  migrations/0001_init.sql       Skema PRD §7 + RLS per-user
  migrations/0002_cron.sql       Jadwal pg_cron (verifier 5 mnt, AI 17:00 WIB)
  migrations/0003_roadmapv2.sql  ALTER journal_entries + tabel trading_plans
  functions/price-verifier/ Edge Function auto SL/TP (Deno)
  functions/ai-daily/       Edge Function AI batch (Deno)
scripts/check-node.mjs      Guard versi Node (predev/prebuild)
```

## Lanjutan

- **Aktifkan Supabase:** [MIGRATION-SUPABASE.md](./MIGRATION-SUPABASE.md)
- **Deploy Edge Functions:** [supabase/functions/README.md](./supabase/functions/README.md)
- **Roadmap & blocker:** [ROADMAP.md](./ROADMAP.md)

## Keputusan desain

- **Multi-currency:** trade disimpan mata uang asli (IDR/USD); agregat portofolio
  dinormalisasi ke IDR via kurs tetap `lib/fx.ts`.
- **Realized/Unrealized P/L:** `size_amount` = notional exposure di entry;
  return = notional × %move × arah.
- **AI:** default deterministik (biaya $0, offline). Set `VITE_ANTHROPIC_API_KEY`
  untuk memakai Claude langsung dari browser **(DEV ONLY)** — produksi lewat Edge Function.
# trading-journal
