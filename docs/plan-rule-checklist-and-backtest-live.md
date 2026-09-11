# Rencana Pengembangan — Backtest Lab Live Price + Strategy Entry-Rule Checklist

Status: **SELESAI** (A–D) · Dibuat & dikerjakan 2026-09-10 · Sumber kebutuhan: user
Traceability: PRD §4.4C (Discipline Score), PRD §8 (Rule Compliance Score),
[roadmapv2.md](../roadmapv2.md) A14 (Backtest Lab), A2 (rule engine).

---

## 1. Ringkasan kebutuhan (systems analysis)

| ID | Kebutuhan user | Kelas |
|---|---|---|
| **R1** | Di Backtest Lab, tampilkan **live price** & **unrealized P/L** untuk trade open, sama seperti Trading Journal. | Enhancement, kecil, mandiri |
| **R2** | Saat membuat Strategy di Playbook, definisikan **aturan entry** (rule list). | Fitur baru — data model |
| **R3** | Saat input trade, tampilkan aturan entry strategi terpilih sebagai **checklist**; user mencentang yang terpenuhi. | Fitur baru — UX + data |
| **R4** (turunan) | Simpan hasil checklist per-trade → hitung **Rule Compliance Score** → jadikan insight (WR/expectancy per tingkat kepatuhan). | Analytics — nilai tinggi |

**Tesis produk yang diperkuat:** aplikasi ini memisahkan *"strateginya yang salah"*
dari *"eksekusinya yang salah"*. `strategyStats` = sumbu kualitas **strategi**.
Rule Compliance = sumbu kualitas **eksekusi**. R2–R4 melengkapi sumbu kedua yang
selama ini hanya diwakili toggle kasar `followed_plan`.

**Prinsip desain yang mengikat:** input harus cepat (satu tap per aturan, tombol
"centang semua"), backward-compatible (strategi/trade lama tanpa aturan tetap
jalan), dan snapshot — perubahan aturan strategi **tidak** boleh mengubah riwayat
kepatuhan trade lama.

---

## 2. R1 — Live price + P/L di Backtest Lab

### 2.1 Kondisi sekarang
- `PricesProvider` ([src/store/prices.tsx](../src/store/prices.tsx)) menghitung `watching`
  (crypto) & `stockWatching` dari `useStore().journal` — yang **sengaja live-only**
  sejak A14, jadi pair backtest tidak diawasi.
- `Journal.tsx` menampilkan harga live per baris + unrealized via `prices[t.pair]`
  + `unrealized(t, price)` ([src/lib/verify.ts](../src/lib/verify.ts)).
- `BacktestLab.tsx` belum menampilkan harga live sama sekali.

### 2.2 Keputusan arsitektur
Trade backtest **open** diperlakukan sebagai *forward paper trade* → layak
diberi harga live, unrealized P/L, dan auto SL/TP.

**Perubahan:** `PricesProvider` mengambil sumber dari `allJournal` (bukan `journal`)
untuk `watching`, `stockWatching`, dan verifikasi. `prices` adalah map keyed by
symbol, jadi `BacktestLab.tsx` cukup membaca `prices[t.pair]` seperti Journal.

**Alasan memilih `allJournal` vs feed terpisah:** feed sudah keyed by symbol dan
idempotent; menambah beberapa pair backtest ke langganan WS / poll saham = biaya
bandwidth dapat diabaikan; `closeTrade`/`resolveAnalysis` bekerja apa adanya untuk
trade backtest (masuk League Table, tidak masuk deteksi perilaku).

### 2.3 Edge case & mitigasi
| Risiko | Mitigasi |
|---|---|
| Backtest historis (entry_at 2 bulan lalu) ter-auto-close di harga **sekarang** saat sempat detik open sebelum user tutup manual. | Verifier hanya memproses trade backtest dengan `entry_at` dalam **N hari terakhir** (usul N=3). Historis lama = murni manual. |
| Toast auto-close membingungkan (live vs backtest). | Label toast: `"(backtest) BTCUSDT menyentuh TP"`. |
| Chip header `LiveStatus` ikut menghitung pair backtest. | Tambah keterangan kecil `· termasuk backtest`. |
| `closed_at = now()` padahal `entry_at` historis → holding period aneh. | Tidak masalah — equity/streak/drawdown pakai `journal` live-only. Dokumentasikan. |

### 2.4 File yang tersentuh
`src/store/prices.tsx` (sumber `allJournal` + guard N-hari + label toast),
`src/pages/BacktestLab.tsx` (baris harga live + kolom unrealized + StatTile
"Unrealized (live)"), `src/components/LiveStatus.tsx` (copy).
Tes: perluas `pages.test.tsx` (sudah render `/backtest`) + smoke `verify` bahwa
trade backtest open masuk `watching`.

### 2.5 Estimasi: **0.5 hari**. Risiko: rendah. Bisa dikerjakan lebih dulu, mandiri.

---

## 3. R2–R4 — Strategy Entry-Rule Checklist

### 3.1 Data model

#### A. Aturan pada Strategy
```ts
interface Strategy {
  // ...existing
  entry_rules: string[]   // urutan bermakna; contoh: "Close H4 di atas level", "Volume ekspansi", "R:R >= 1:2"
}
```
- Migrasi: `repository.migrate()` backfill `entry_rules: s.entry_rules ?? []`.
- Sheets `Code.gs` schema `strategies` + `['entry_rules', 'arr']` (serialisasi
  `a | b | c`). **Wajib re-deploy Web App.**
- Supabase: `alter table user_strategies add column entry_rules text[] default '{}'`
  (migration `0004_strategy_rules.sql`) + mapper `repository.supabase.ts`.

#### B. Snapshot checklist per-trade
```ts
interface RuleCheck { rule: string; checked: boolean }
interface JournalEntry {
  // ...existing
  rule_checks: RuleCheck[]   // snapshot teks aturan SAAT entry + status centang
}
```

**Kenapa snapshot teks, bukan index/id (NFR3):** strategi bisa di-edit, aturan
di-reorder/hapus, bahkan strategi di-hapus (`strategy_id` jadi `null`). Menyimpan
index akan merusak arti "3/5 aturan terpenuhi" pada trade lama. Menyimpan teks
membuat setiap trade self-contained.

**Alternatif yang ditolak:**
- `checked_rule_indexes: number[]` + baca `strategy.entry_rules` sekarang → rapuh
  terhadap edit/hapus. **Ditolak (NFR3).**
- Tabel normal `journal_rule_checks(journal_id, rule, checked)` (à la
  `journal_reason_tags` di PRD) → menambah koleksi ke-5 pada store snapshot-penuh,
  plus CRUD + tab Sheets + migrate. **Overkill** untuk store prototipe.

#### Persistensi `rule_checks`
| Backend | Cara simpan |
|---|---|
| localStorage | native JSON (store men-serialize seluruh DB) — tanpa perubahan |
| Supabase | `rule_checks jsonb default '[]'` |
| Google Sheets | kolom tunggal, cell type baru **`kv`**: `"rule teks::1 ; rule lain::0"` (item sep `;`, field sep `::`). `parseCell_`/`serializeCell_` di `Code.gs` menangani. **Batasan:** teks aturan tidak boleh mengandung `;` atau `::` — di-sanitize di `StrategyForm` saat parse. |

Cell type `kv` dipilih daripada JSON-di-sel supaya sheet tetap terbaca manusia
(tujuan storage Sheets), dan daripada dua kolom `rules_all`+`rules_checked` supaya
tidak ada state redundan yang bisa desync.

### 3.2 Helper murni (testable) — `src/lib/finance.ts` atau modul baru `rules.ts`
```ts
/** checked / total; null bila trade tak punya aturan (strategi tanpa rules / tanpa strategi). */
export function ruleCompliance(t: JournalEntry): number | null

/** Saat edit trade / ganti strategi: pertahankan status centang untuk aturan yang
 *  teksnya sama, aturan baru => unchecked, aturan hilang => dibuang. */
export function reconcileRuleChecks(prev: RuleCheck[], currentRules: string[]): RuleCheck[]
```

### 3.3 UI / komponen

#### StrategyForm (Playbook)
- Tambah field **"Aturan entry"** — `<TextArea>` "satu aturan per baris"
  (konsisten dengan field `no_trade_rules` di Trading Plan; **nol komponen baru**).
- Parse pada submit: split `\n`, trim, buang baris kosong, buang karakter `;`/`::`.
- Prefill dari `initial.entry_rules.join('\n')` di mode edit.

#### JournalForm (dipakai Journal **dan** Backtest Lab)
- Bila strategi terpilih punya `entry_rules.length > 0` → render blok **Checklist
  aturan entry**: satu baris checkbox per aturan + tombol **"Centang semua"**.
- State `ruleChecks: Record<string, boolean>` keyed by teks aturan.
- Ganti strategi → reset checklist ke aturan strategi itu (mode create).
- Mode edit → prefill via `reconcileRuleChecks(initial.rule_checks, strategy.entry_rules)`.
- Di strip auto-kalkulasi tampilkan badge **`Compliance 3/5 (60%)`**; tone `warn`
  bila `<100%` sementara `followed_plan = true` (nudge inkonsistensi:
  *"kamu tandai 'sesuai rencana' tapi 2 aturan tak tercentang"*).
- Submit → `rule_checks: strategy.entry_rules.map(r => ({ rule: r, checked: !!ruleChecks[r] }))`.
- "Tanpa Strategi" atau strategi tanpa aturan → blok tidak muncul, `rule_checks: []`.

#### Journal & Backtest Lab pattern-view (baris tabel)
- Chip kepatuhan kecil `4/5` di kolom **Eksekusi** (dekat badge SOP), warna dari
  rasio (≥0.8 win / ≥0.5 warn / <0.5 lose). `—` bila `null`.

#### CloseTradeDialog (opsional, fase D)
- Tampilkan checklist entry **read-only** sebagai pengingat ("kamu masuk dengan 3/5 aturan").

#### Insights — widget "Rule Compliance vs Performa"
- Tabel mirip `PsychologyTable`: bucket kepatuhan `[100%] [80–99%] [50–79%] [<50%]`
  → kolom Trade / Win Rate / Avg R / Expectancy.
- Sumber: `src/lib/analytics.ts` fungsi baru `byRuleCompliance(entries)`.

### 3.4 Integrasi dengan mesin yang ada

| Titik | Perubahan |
|---|---|
| `rules.ts` `disciplineScore(trade)` | Bila `rule_checks` ada → pakai `compliance` sebagai sinyal disiplin utama: `score -= round((1 - compliance) * 40)` menggantikan penalti `-30 followed_plan` (tetap pakai penalti lama bila aturan tidak didefinisikan). |
| `rules.ts` `autoInsights()` | Insight baru (kind `behavioral` atau kind baru `discipline`): *"Trade dengan compliance ≥80% → expectancy +Rp X (n=..). Compliance <80% → −Rp Y (n=..). Perbaiki eksekusi sebelum menilai strategi."* — ini fitur pembunuh PRD §8. |
| `finance.ts` `strategyStats` | **Tidak berubah** — strategi vs eksekusi tetap dua sumbu terpisah. (Fase E: opsi filter "hanya compliance 100%" untuk melihat potensi strategi murni.) |
| `followed_plan` | Dipertahankan sebagai biner cepat. Nudge konsistensi di form. Opsi masa depan: auto-set `followed_plan = (compliance === 1)` bila aturan ada. |
| CSV export/import | Kolom `entry_rules` (strategi tidak diekspor CSV saat ini — lewati) dan `rule_checks` (kv-encoded) di export jurnal; import: parse balik, atau kosongkan bila header absen. |

### 3.5 Analisis lanjutan (Fase E, ditunda)
**Per-rule impact:** *"Saat kamu skip 'Volume ekspansi', WR 34% vs 68% saat dicek."*
Butuh ≥ ~30 trade closed per strategi agar tidak jadi noise. Implementasi:
`byRulePresence(entries, strategyId)` → untuk tiap aturan, bandingkan subset
checked vs unchecked. Tunda sampai data cukup.

---

## 4. Fase pengerjaan & urutan

```
A ─ Live price Backtest Lab                                ✅ commit feat(backtest)
B ─ Data model entry_rules + rule_checks + helper + tes    ✅
C ─ Checklist di JournalForm + StrategyForm rules editor   ✅
D ─ Compliance: chip baris, byRuleCompliance, autoInsights,
    disciplineScore, widget Insights                       ✅
E ─ Per-rule impact analysis                               ditunda (butuh data)
```

Hasil seed demo: `byRuleCompliance` → compliance 100% (n=17, WR 71%, +Rp 454k/trade)
vs <50% (n=7, WR 0%, −Rp 359k). `autoInsights` memunculkan insight
"Eksekusi: kepatuhan aturan menentukan hasil" di posisi teratas.

Total inti (A–D): **~3.5–4 hari**.

### Dependency graph
```
A  (independent)
B ──► C ──► D
```

---

## 5. Rencana pengujian

| Level | Cakupan |
|---|---|
| Unit (Vitest) | `ruleCompliance`, `reconcileRuleChecks`, `byRuleCompliance`, `disciplineScore` (jalur compliance), `verify` (guard N-hari backtest). |
| Serialisasi | Round-trip `kv` cell type — tes JS murni terhadap fungsi `parseCell_`/`serializeCell_` yang diekstrak, atau prosedur manual terdokumentasi bila tetap di `Code.gs`. |
| Komponen (jsdom) | `StrategyForm` menyimpan/menampilkan aturan; `JournalForm` merender checklist untuk strategi ber-aturan, centang → submit → `rule_checks` benar; mode edit `reconcile` mempertahankan status. |
| Render smoke | `/playbook`, `/journal`, `/backtest` tetap render (pages.test.tsx). |
| Integrasi (vite-node) | seed: strategi + aturan → buat trade → compliance terhitung → `autoInsights` memunculkan insight compliance. |

Target: seluruh suite hijau (saat ini 64 tes), + ~12–15 tes baru.

---

## 6. Migrasi & rollout

1. `repository.migrate()` — backfill `entry_rules: []`, `rule_checks: []`. Aman,
   idempoten, sudah ada pola-nya.
2. `sheets.ts normalize()` — backfill dua field itu pada data yang ditarik dari Sheet.
3. `supabase/migrations/0004_strategy_rules.sql` — `add column` additive (nullable/
   default), tidak memblok.
4. `google-apps-script/Code.gs` — tambah kolom schema + `kv` cell type →
   **user wajib re-deploy Web App** (Deploy ▸ Manage deployments ▸ New version).
   Bila belum re-deploy: kolom baru hilang saat baca → `parseCell_` kembalikan
   default (`[]`) → aman, hanya fitur checklist tidak persist ke Sheet sampai re-deploy.
5. Seed: 2–3 strategi diberi `entry_rules` contoh + beberapa trade seed dengan
   `rule_checks` bervariasi supaya demo Insights & chip terlihat.

---

## 7. Ringkasan file terdampak

**R1:** `src/store/prices.tsx`, `src/pages/BacktestLab.tsx`, `src/components/LiveStatus.tsx`.

**R2–R4:**
- Tipe & data: `src/types.ts`, `src/data/seed.ts`, `src/store/repository.ts`,
  `src/store/repository.supabase.ts`, `supabase/migrations/0004_strategy_rules.sql`,
  `google-apps-script/Code.gs`, `src/lib/sheets.ts`.
- Store: `src/store/store.tsx` (`JournalInput.rule_checks`, `mkTrade` passthrough;
  `StrategyInput.entry_rules`).
- Logika: `src/lib/finance.ts` (atau `rules.ts`) — `ruleCompliance`,
  `reconcileRuleChecks`; `src/lib/analytics.ts` — `byRuleCompliance`;
  `src/lib/rules.ts` — `disciplineScore`, `autoInsights`.
- UI: `src/features/playbook/StrategyForm.tsx`, `src/features/journal/JournalForm.tsx`,
  `src/pages/Journal.tsx` (chip), `src/pages/BacktestLab.tsx` (chip),
  `src/pages/Insights.tsx` (widget), `src/features/insights/` (komponen tabel baru),
  opsional `src/features/journal/CloseTradeDialog.tsx`.
- Tes: `src/lib/*.test.ts(x)`, `src/pages/pages.test.tsx`.
- Docs: `roadmapv2.md` (A15), `docs/data-model.md`, `README.md`,
  `docs/google-sheets-storage.md`.

---

## 8. Keputusan (sudah dikonfirmasi user 2026-09-10)

1. **Auto SL/TP untuk trade backtest**: ✅ AKTIF dengan guard `entry_at` ≤ 3 hari.
   Backtest historis lama = manual saja.
2. **`disciplineScore`**: ✅ compliance **menggantikan** penalti `followed_plan`
   saat strategi punya aturan (hindari double-count). `followed_plan` tetap ada
   sebagai biner cepat + nudge konsistensi.
3. **Strategi `active`**: ✅ WAJIB minimal 1 `entry_rule`. `StrategyForm` memblokir
   ubah status → `active` bila `entry_rules` kosong.
4. `rule_checks` di Google Sheet: cell type **`kv`** + sanitize teks aturan
   (buang `;` dan `::`). (keputusan implementasi, tidak perlu konfirmasi)
