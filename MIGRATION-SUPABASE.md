# Aktivasi Supabase (dari prototype localStorage → backend nyata)

Semua kode sudah ditulis & type-checked. Aplikasi tetap jalan di localStorage
sampai langkah 3 dilakukan.

## 1. Siapkan database

```bash
brew install supabase/tap/supabase      # sekali
open -a Docker                           # nyalakan Docker Desktop
cd "Trading Journal"
supabase start                           # boot Postgres + Auth + Studio lokal
supabase db reset                        # apply migrations/0001_init.sql + 0002_cron.sql
supabase status                          # salin API URL + anon key
```

Untuk cloud: `supabase link --project-ref <ref>` lalu `supabase db push`.

## 2. Env

```bash
cp .env.example .env.local
# isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY dari `supabase status`
```

`src/lib/supabase.ts` otomatis mengaktifkan client saat kedua var ada
(`supabaseEnabled === true`).

## 3. Flip data layer

Store saat ini memakai snapshot seluruh-DB yang sinkron (`repository.ts`).
Versi Supabase (`repository.supabase.ts`) sudah lengkap tapi **async row-level**.
Perubahan di `src/store/store.tsx`:

1. Tambah `AuthProvider` (Supabase `auth.getSession()` + `onAuthStateChange`) dan
   gate `<App/>` di belakang layar login/register (`supabase.auth.signInWithPassword` /
   `signUp`).
2. Ganti state awal:
   ```ts
   // dari
   const [db, setDb] = useState<DB>(() => repository.read())
   // jadi
   const [db, setDb] = useState<DB>({ strategies: [], journal: [], analyses: [] })
   useEffect(() => { fetchAll().then(setDb) }, [userId])
   ```
   (`fetchAll` dari `repository.supabase.ts`)
3. Jadikan tiap action `async` dan panggil fungsi row-level, lalu re-fetch atau
   update state lokal secara optimistik. Contoh:
   ```ts
   addStrategy: async (s) => {
     const row = await insertStrategy(userId, s)
     setDb((d) => ({ ...d, strategies: [row, ...d.strategies] }))
   }
   ```
   `closeTrade` menghitung `realized_pnl`/`realized_rr` di client (fungsi di
   `lib/finance.ts` sudah ada) lalu `patchTrade(id, { status:'closed', ... })`.
4. Hapus pemanggilan `repository.reset()/clear()` dari sidebar (atau ganti jadi
   operasi khusus dev).
5. `planned_rr` adalah kolom generated di DB — jangan dikirim saat insert.
6. Realtime opsional: `supabase.channel('...').on('postgres_changes', ...)` untuk
   sinkron multi-tab; jika dipakai, verifier Edge Function bisa gantikan
   `src/store/prices.tsx` auto-verify.

## 4. Edge Functions (Fase 2 & 5 server-side)

```bash
supabase functions deploy price-verifier --no-verify-jwt
supabase functions deploy ai-daily --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# lalu di SQL editor: jalankan migrations/0002_cron.sql (ganti <PROJECT_REF> + simpan service_role_key ke Vault)
```

Setelah verifier server aktif, `autoVerify` di client bisa dimatikan default
(biarkan server sebagai sumber kebenaran; client cukup subscribe realtime).
