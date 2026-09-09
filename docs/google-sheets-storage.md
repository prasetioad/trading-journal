# Storage sementara: Google Sheets

Sheet: <https://docs.google.com/spreadsheets/d/1r5Abt0hskodM-pUQjLwQmwEIv4-yQBUIiCmoEjRIWVw/edit>

Aplikasi tetap memakai **localStorage sebagai cache** (instan & offline); Google
Sheet menjadi **penyimpanan durable**. Saat app dibuka → tarik dari Sheet.
Setiap perubahan → dorong balik sebagai snapshot penuh (debounce 1.5 dtk).
Indikator status ada di header ("Sheets: tersimpan / menyimpan… / gagal").

> Screenshot **tidak** ikut ke Sheet (data URL terlalu besar untuk sel) — tetap
> tersimpan di browser perangkat itu saja.

---

## Setup (sekali, ~3 menit)

1. Buka spreadsheet di atas → menu **Extensions ▸ Apps Script**.
2. Hapus isi `Code.gs` bawaan, tempel isi [`google-apps-script/Code.gs`](../google-apps-script/Code.gs) dari repo ini.
   `SPREADSHEET_ID` sudah diisi dengan ID sheet tersebut.
3. **Deploy ▸ New deployment**:
   - Klik ⚙️ → pilih tipe **Web app**.
   - *Description*: bebas.
   - *Execute as*: **Me**.
   - *Who has access*: **Anyone**.
   - **Deploy** → izinkan akses saat diminta.
4. Salin **Web app URL** (berakhiran `/exec`).
5. Di project ini, buat `.env.local` (kalau belum ada):

   ```
   VITE_SHEETS_WEBAPP_URL=https://script.google.com/macros/s/XXXXXXXX/exec
   ```

6. Restart `npm run dev`. Header akan menampilkan "Sheets: memuat…" lalu "tersimpan".

Kalau Sheet masih kosong saat pertama konek, data demo lokal otomatis ditulis ke Sheet.

---

## Harga saham IDX (auto SL/TP)

`Code.gs` yang sama juga jadi **proxy harga saham** (Yahoo Finance, server-side,
tanpa masalah CORS):

```
GET <WEBAPP_URL>?action=quote&symbols=BBCA.JK,BBRI.JK
-> [{ symbol, price, dayLow, dayHigh, time, currency }]
```

Aplikasi otomatis:
- Meng-poll harga tiap **60 detik** untuk setiap trade **stock** yang `open` dan
  prediksi stock yang `pending` (ticker IDX otomatis diberi akhiran `.JK`).
- Menutup trade / me-resolve prediksi saat **range harian [low, high]** menyentuh
  SL/TP (pakai range, bukan cuma harga terakhir, supaya sentuhan intraday tidak
  terlewat walau data delay ~15 menit). SL dicek lebih dulu bila keduanya masuk range.
- Mencatat `closed_at` = waktu deteksi (delay), dan toast menyertakan timestamp
  data Yahoo.

Chip **"IDX (delay) · N saham"** muncul di header saat ada saham yang diawasi.

> Kalau `VITE_SHEETS_WEBAPP_URL` tidak diset, app pakai proxy CORS publik
> (`api.allorigins.win`) — jalan tapi kurang stabil. Override dengan
> `VITE_STOCK_PROXY=` di `.env.local` bila punya proxy sendiri.

**Setelah mengubah `Code.gs`** (mis. menambah fitur quote ini), kamu **wajib
re-deploy**: Apps Script ▸ **Deploy ▸ Manage deployments ▸** (pensil) ▸ *Version:
New version* ▸ **Deploy**. URL `/exec` tetap sama.

---

## Bentuk data di Sheet

4 tab dibuat otomatis: `strategies`, `journal`, `analyses`, `plans`.
Baris 1 = header (nama field). Array (mis. `setup_tags`, `mistakes`, `key_levels`)
disimpan sebagai teks `a | b | c`. Jadi datamu tetap enak dibaca/difilter langsung
di Google Sheets untuk melihat pola.

Kolom penting di tab `journal` untuk analisa pola:
`entry_at, pair, strategy_id, setup_tags, market_condition, psychology,
followed_plan, risk_pct, confidence, reasoning, realized_pnl, realized_rr, mistakes`.

---

## Catatan & batasan

- **Keamanan**: Web App "Anyone" bisa diakses siapa saja yang tahu URL-nya.
  Isinya hanya jurnal trading (bukan kredensial). Jaga URL tetap privat; untuk
  memutus akses, hapus deployment-nya.
- **Konkurensi**: satu snapshot penuh per simpan — jangan buka app di dua tab/
  perangkat sekaligus untuk sesi menulis yang sama (yang terakhir menyimpan menang).
- **Kuota Apps Script**: ~20k pemanggilan/hari — jauh di atas kebutuhan 1 user.
- **Kembali ke localStorage saja**: hapus `VITE_SHEETS_WEBAPP_URL` dari `.env.local`,
  restart. Data terakhir tetap ada di cache localStorage.
- Ini **sementara**. Rencana akhir tetap Supabase (Track B di `roadmapv2.md`).
