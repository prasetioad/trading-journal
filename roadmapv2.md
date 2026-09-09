# Roadmap V2 — Trading Journal → Trading Performance Analytics

**Posisi produk:** dari "aplikasi mencatat trade" menjadi **"Find your trading edge"** —
mesin analitik performa + behavioral insights + AI coach, dibangun **di atas** fondasi
anti-strategy-hopping yang sudah ada (PRD v2.1), bukan menggantinya.

**Status:** `✅ selesai` · `🟡 sebagian` · `⛔ butuh kredensial eksternal` · `⬜ belum`
Legenda commit: setiap item selesai → satu commit `type(scope): …`.

---

## 0. Rekonsiliasi dengan kode yang sudah ada

`roadmapv2` versi awal ditulis seolah mulai dari nol. Faktanya sebagian besar
Phase 1–3-nya **sudah terkirim** dengan nama lain:

| Rencana awal roadmapv2 | Realita di repo | Tindakan |
|---|---|---|
| `src/lib/analytics.ts` (Win Rate, Expectancy, Equity) | ada di [src/lib/finance.ts](src/lib/finance.ts) | `analytics.ts` baru = **hanya** dimensi baru (waktu/sesi/tag/DNA) |
| `src/lib/rules.ts` (discipline_score) | `disciplineSummary` / `leakSummary` di finance.ts | `rules.ts` baru = **flag perilaku** (revenge, risk-creep, overtrade) + skor per-trade |
| AI weekly review | AI *daily* briefing ([src/lib/ai/engine.ts](src/lib/ai/engine.ts)) | tambah mode weekly, feed dimensi baru |
| Binance import | live price ([src/lib/binance.ts](src/lib/binance.ts)) | tambah `fetchKlines()` untuk **replay**, bukan sync akun |
| `store/repository.supabase.ts` | ada di `src/store/`, ditulis & type-checked, **belum di-wire** | biarkan; aktivasi = track terpisah (Auth) |

**Prasyarat yang hilang di roadmapv2 & jadi blocker nyata:** Auth / RLS / multi-user.
Ditambahkan sebagai **Track B** di bawah.

---

## Track A — Fitur (credential-free, dikerjakan sekarang)

### A0 — Data model extension  ✅
Bukan skema baru — **ALTER** skema yang ada.
- [x] `src/types.ts`: `JournalEntry` + `entry_at`, `exit_at`, `planned_entry`, `setup_tags[]`,
  `market_condition`, `confidence` (1–10), `risk_pct`, `screenshot_ref`, `mistakes[]`.
- [x] Konstanta baru: `MARKET_CONDITIONS`, `SETUP_TAGS`, `TRADING_SESSIONS`, helper `sessionOf(iso)`.
- [x] Tipe baru `TradingPlan` (Track A5).
- [x] `src/data/seed.ts`: isi field baru realistis (jam entry bervariasi lintas sesi,
  tag setup, market condition, beberapa mistake).
- [x] `supabase/migrations/0003_roadmapv2.sql`: `alter table … add column`, tabel `trading_plans`.
- [x] `src/store/repository.supabase.ts`: mapper kolom baru + `trading_plans`.
- [x] `docs/data-model.md`: payload contoh + mapping kolom.
- **Acceptance:** trade lama tetap terbaca (field baru nullable/berdefault); seed baru lengkap.

### A1 — Analytics engine (dimensi baru)  ✅
`src/lib/analytics.ts`, pure, tanpa dependency:
- [x] Performa per **jam** (0–23) & per **sesi** (Asia/London/New York/overlap).
- [x] Performa per **hari dalam minggu**.
- [x] Performa per **setup tag** (Win Rate, Avg R, Expectancy).
- [x] Performa per **market condition**.
- [x] **Streak** (current / best win / worst loss) & **max drawdown** (seri R & currency).
- [x] **Trading DNA** (best market / setup / session / jam optimal / risk optimal + strength/weakness).
- **Acceptance:** unit test hijau; angka konsisten dengan `finance.ts` untuk himpunan sama.

### A2 — Behavioral rule engine  ✅
`src/lib/rules.ts`, pure:
- [x] Detektor: **revenge trading** (entry cepat setelah loss + size naik),
  **risk creep** (risk% naik setelah menang/kalah beruntun),
  **overtrading** (jumlah trade/hari > ambang),
  **late entry** (`entry` jauh dari `planned_entry`),
  **cut profit early** (realized R jauh < planned R pada trade menang).
- [x] `disciplineScore(trade)` per-trade (0–100) + alasan.
- [x] `autoInsights(journal, strategies)` → daftar temuan berperingkat
  (`Your Edge` / `Your Weakness` / `Behavioral` / `Time` / `Risk`).
- **Acceptance:** seed menghasilkan minimal 1 revenge flag & 1 edge finding; test hijau.

### A3 — Test infrastructure  ✅
- [x] Tambah `vitest` + script `npm test`.
- [x] `src/lib/finance.test.ts`, `rules.test.ts`, `analytics.test.ts`.
- **Acceptance:** `npm test` hijau di CI lokal.

### A4 — Insights page  ✅
`src/pages/Insights.tsx` + `src/features/insights/*`:
- [x] Kartu otomatis: Edge / Weakness / Behavioral / Time / Risk (dari `autoInsights`).
- [x] Chart performa per jam & per sesi.
- [x] Tabel performa per setup tag & market condition.
- [x] Trading DNA card.
- [x] Weekly Review (teks dari AI engine mode weekly, fallback deterministik).
- **Acceptance:** halaman render penuh dari seed; nav di sidebar.

### A5 — Trading Plan module  ✅
`src/pages/Plan.tsx` + `src/features/plan/*`:
- [x] Buat plan harian: bias, key levels, allowed setups, max trades, max daily loss (R), no-trade rules.
- [x] **Plan vs Actual**: bandingkan plan hari-X dengan trade aktual hari itu (jumlah, risk, setup, loss).
- [x] Store CRUD + persist (localStorage sekarang, Supabase-ready).
- **Acceptance:** plan tersimpan; komparasi menandai pelanggaran (⚠️).

### A6 — Dashboard: Calendar + Streak/Drawdown  ✅
- [x] `src/features/dashboard/TradingCalendar.tsx`: kalender bulanan P/L per hari, klik → trade hari itu.
- [x] `src/features/dashboard/StreakDrawdown.tsx`: streak + drawdown stats + mini equity.
- [x] Pasang di `Dashboard.tsx`.

### A7 — NL search  ✅
- [x] `src/lib/search.ts`: parser deterministik NL → filter
  (`pair`, `setup`, `sesi`, `risk < x`, `outcome`, `rentang tanggal`, `strategi`).
- [x] Bar query di `Journal.tsx` → hasil + ringkasan (n trades, win rate, expectancy).
- [x] Hook opsional ke AI bila key tersedia (fallback: parser).
- **Acceptance:** "BTC breakout london risk < 1.5% 6 bulan terakhir" ter-parse jadi filter benar.

### A8 — Trade replay  ❌ DIBATALKAN (2026-09-09)
Dihapus atas permintaan — bukan prioritas untuk tujuan "lihat pola perilaku".
`fetchKlines` / `ReplayDialog` dihapus; `binance.ts` kini hanya `fetchSpotSymbols()`
untuk pair picker (A11).

### A11 — Journal editable + pair picker + pattern view  ✅
- [x] `store.updateTrade(id, patch)` — edit field apa pun; `direction` & (jika closed)
  `realized_pnl/rr/outcome` dihitung ulang otomatis.
- [x] `JournalForm` mode edit (`initial`) + `Combobox` searchable + `src/lib/pairs.ts`
  (kurasi ~70 pair + live Binance `exchangeInfo`, cache 24 jam) untuk pair crypto
  di form jurnal & analisa.
- [x] List jurnal jadi **pattern view**: strip ringkas, kolom Sinyal (discipline
  per-trade + chip revenge/risk-creep/overtrade/late-entry/cut-cepat), sesi +
  market condition per baris, sort by discipline/PL/RR/confidence, toggle
  "kelompokkan per hari" (menandai tilt day).

### A9 — Screenshot upload (prototype)  ✅
- [x] `JournalForm`: input file → simpan sebagai data-URL di `screenshot_ref`
  (abstraksi `src/lib/storage.ts` — swap ke Supabase Storage saat Track B).
- [x] Tampilkan thumbnail di baris jurnal + lightbox.
- [x] Batas ukuran + kompres di client.
- **Acceptance:** upload gambar → tampil di jurnal, persist antar reload.

### A10 — CSV import + polish  ✅
- [x] `src/lib/csv.ts`: `parseJournalCsv()` (kolom = header export saat ini + field baru opsional).
- [x] Tombol "Import CSV" di `Journal.tsx` (preview + konfirmasi).
- [x] Update `ROADMAP.md`, `README.md`.
- [x] `npm run typecheck` + `npm run lint` + `npm run build` hijau.

---

### A12 — Storage sementara: Google Sheets  ✅
- [x] `src/lib/sheets.ts` + `google-apps-script/Code.gs` + hybrid di `store.tsx`
  (localStorage = cache instan, Sheet = durable; pull saat boot, push snapshot
  debounce). Indikator `StorageStatus` di header. Screenshot tidak ikut ke Sheet.
- [x] Setup: deploy Web App, isi `VITE_SHEETS_WEBAPP_URL` — [docs/google-sheets-storage.md](docs/google-sheets-storage.md).
- Ini jembatan sebelum Supabase (Track B).

---

## Track B — Aktivasi backend Supabase (⛔ butuh akun/kredensial user)

Kode sudah siap; yang kurang hanya kredensial. Storage saat ini = Google Sheets
(A12) sebagai solusi sementara. Migrasi final di [MIGRATION-SUPABASE.md](MIGRATION-SUPABASE.md).

| Item | Status | Aksi user |
|---|---|---|
| Supabase project + `.env.local` | ⛔ | buat project, isi `VITE_SUPABASE_URL` / `ANON_KEY` |
| Auth (login/register) + guard rute | ⬜→siap | tambah `AuthProvider` saat repository di-flip |
| Flip store ke `repository.supabase.ts` (async row-level) | 🟡 | ikuti MIGRATION-SUPABASE.md |
| Screenshot → Supabase Storage bucket | 🟡 | ganti body `src/lib/storage.ts` |
| Edge Function `ai-daily` deploy + `ANTHROPIC_API_KEY` | 🟡 | `supabase secrets set` + `functions deploy` |
| `price-verifier` cabang saham IDX | ⛔ | pilih provider data IDX, implementasi `fetchStockQuotes()` |

---

## Track C — Nanti (di luar sesi ini)

- Screener setup (OHLCV) — Non-Goal PRD v2.1 / roadmapv2 Phase 4.
- Export PDF laporan bulanan.
- Anotasi gambar (gambar garis di screenshot).
- CI pipeline (`npm test` + lint) di GitHub Actions.
- Kebijakan privasi & enkripsi screenshot di storage.

---

## Ringkasan estimasi

| Track | Cakupan | Estimasi |
|---|---|---|
| A0–A10 | fitur credential-free | **sesi ini** |
| B | aktivasi Supabase + Auth + AI deploy | 3–5 hari setelah kredensial |
| C | screener, PDF, anotasi, CI | 3–6 minggu |
