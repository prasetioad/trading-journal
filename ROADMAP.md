# Roadmap — Trading Journal & Analysis

Status per 2026-09-09. Legenda: ✅ selesai · 🟡 sebagian · ⛔ terblokir (butuh input eksternal) · ⬜ belum.

> **Roadmap V2** (reposisi ke "Trading Performance Analytics — Find your trading edge")
> ada di [roadmapv2.md](roadmapv2.md). **Track A (fitur credential-free) selesai:**
> data model extension + `trading_plans`, `lib/analytics.ts` (jam/sesi/hari/setup/
> market/streak/drawdown/DNA), `lib/rules.ts` (behavioral flags + autoInsights),
> Vitest (36 test), halaman **Insights** & **Trading Plan**, Trading Calendar,
> Streak/Drawdown, NL search, trade replay (Binance klines), screenshot upload,
> CSV import. **Track B** (flip Supabase + Auth, screenshot→Storage, deploy
> `ai-daily`, provider IDX) menunggu kredensial — sama dengan blocker di bawah.

---

## Ringkasan eksekusi sesi ini

1. **Fix `npm run dev`** — penyebab: shell default pakai Node 16, Vite 8 butuh Node ≥ 20.19.
   Ditambahkan: `engines`, `.npmrc` (`engine-strict`), guard `scripts/check-node.mjs` di `predev`/`prebuild`
   yang gagal dengan pesan jelas + instruksi `nvm use`. `.nvmrc` sudah ada.
2. **Fase 2 (verifikasi otomatis crypto)** — live price Binance + auto SL/TP + auto-resolve prediksi. ✅
3. **Fase 3 (dashboard analytics)** — ditambah Equity Curve, Audit Psikologi vs Performa, Live Positions,
   KPI Unrealized (live). ✅
4. **Fase 5 (AI engine)** — prompt batch nyata + engine pluggable (Claude API bila ada key, else deterministik)
   + tombol Regenerate + flag `analyzed_by_ai`. 🟡 (Edge Function scaffold siap, deploy butuh kredensial)
5. **Fase 7 (polish)** — export CSV (jurnal + analisa), toast notifications, layout mobile (drawer). ✅
6. **Kesiapan Supabase** — client, repository async, 2 Edge Function, migration cron. 🟡 (aktivasi butuh Docker + project)

---

## Fase 1 — MVP Fondasi & Playbook  ✅

| Item | Status |
|---|---|
| CRUD Strategy Playbook + Sample Size Tracker | ✅ |
| Form jurnal (followed_plan, dropdown strategi, psikologi tetap, Planned R:R live) | ✅ |
| Lifecycle open → closed (manual) + Realized P/L / R:R / Win-Lose | ✅ |
| CRUD Analisa/Prediksi | ✅ |
| Edit strategi | ✅ |
| Auth (login/register) | ⛔ butuh Supabase aktif — form & guard ditambahkan saat repository di-flip |

## Fase 2 — Verifikasi Otomatis Crypto  ✅

| Item | Status | Catatan |
|---|---|---|
| Live price crypto | ✅ | `src/lib/binance.ts` — WebSocket `stream.binance.com` + fallback REST poll (`data-api.binance.vision`, CORS-ok) tiap 5 dtk |
| Auto-close SL/TP (jurnal) | ✅ | `src/lib/verify.ts` + `src/store/prices.tsx`; toggle "Auto SL/TP" di header; toast saat terpicu |
| Auto-resolve target/invalidation (prediksi) | ✅ | idem |
| Unrealized P/L + progress-to-TP di UI | ✅ | Journal rows, Analysis cards, widget Live Positions |
| Verifikasi sisi server | 🟡 | `supabase/functions/price-verifier` (Deno) — logika sama, deploy butuh project |

## Fase 3 — Dashboard Analytics & Widgets  ✅

| Item | Status |
|---|---|
| AI Executive Briefing (top widget) | ✅ |
| Strategy League Table (Win Rate, Planned→Realized R:R, Profit Factor, Expectancy, sample badge) | ✅ |
| Emotional Leak Detector + simulasi portofolio | ✅ |
| Discipline Meter (gauge) | ✅ |
| R:R Execution Inefficiency Gap (chart) | ✅ |
| Equity Curve (akumulasi Realized P/L) | ✅ |
| Audit Psikologi vs Performa | ✅ |
| Live Positions (unrealized realtime) | ✅ |
| Filter rentang tanggal di dashboard | ⬜ next |

## Fase 4 — Live Price Saham IDX  ⛔

Butuh provider data saham IDX (mis. RTI, IDX API berbayar, atau scraping resmi).
Sudah disiapkan: input harga manual tetap jalan; `price-verifier` punya `TODO(Fase 4)` untuk cabang `asset_type='stock'`.
**Aksi user:** pilih & sediakan kredensial provider → implementasikan `fetchStockQuotes()` di Edge Function.

## Fase 5 — AI Daily Batch Engine  🟡

| Item | Status | Catatan |
|---|---|---|
| Prompt batch (system + user) | ✅ | `src/lib/ai/prompt.ts` — dependency-free, dipakai bersama Edge Function |
| Engine pluggable | ✅ | `src/lib/ai/engine.ts` — Claude API bila `VITE_ANTHROPIC_API_KEY`, else deterministik (biaya $0) |
| Tombol Regenerate + cache + flag `analyzed_by_ai` | ✅ | |
| Edge Function harian 17:00 WIB | 🟡 | `supabase/functions/ai-daily` (Deno) — upsert `journal_daily_insights`, insert `journal_reason_tags` |
| Jadwal pg_cron | 🟡 | `supabase/migrations/0002_cron.sql` |
| **Aktivasi** | ⛔ | butuh `supabase link` + `supabase secrets set ANTHROPIC_API_KEY=…` + `functions deploy` |

## Fase 6 — Screener Setup Saham/Crypto  ⬜

Ditunda oleh PRD sendiri (Non-Goal v2.1). Belum dikerjakan.

## Fase 7 — Polish & Hardening  🟡

| Item | Status |
|---|---|
| Export CSV (jurnal + analisa) | ✅ `src/lib/csv.ts` |
| In-app notification (toast) | ✅ `src/components/ui/Toast.tsx` |
| Mobile responsive (sidebar → drawer, header adaptif) | ✅ |
| Export PDF | ⬜ (CSV dulu; PDF butuh lib cetak) |
| Reset/seed data demo | ✅ |

---

## Yang memblokir "selesai end-to-end" & aksinya

| Blocker | Dampak | Aksi |
|---|---|---|
| Docker daemon mati + Supabase CLI belum terpasang | Tak bisa `supabase start` / test backend lokal | `brew install supabase/tap/supabase`, jalankan Docker Desktop, `supabase start` |
| Belum ada project Supabase + kredensial | Persistensi masih localStorage | buat project, isi `.env.local`, ikuti `MIGRATION-SUPABASE.md` |
| Belum ada `ANTHROPIC_API_KEY` | AI briefing pakai fallback deterministik | set env (dev) atau `supabase secrets set` (prod) |
| Belum ada provider data saham IDX | Harga saham manual saja | pilih provider, implementasikan di `price-verifier` |

## Next (tak terblokir)

- Filter rentang tanggal di dashboard + per-strategy drill-down.
- Konversi store ke operasi async row-level (prasyarat flip Supabase) — lihat `MIGRATION-SUPABASE.md`.
- Export PDF laporan bulanan.
- Unit test untuk `src/lib/finance.ts` & `src/lib/verify.ts` (Vitest).
