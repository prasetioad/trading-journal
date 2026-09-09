# Supabase — skema & setup lokal

Belum di-wire ke app (prototype pakai localStorage). File di sini adalah target
migrasi Fase 2+.

## Isi

- `migrations/0001_init.sql` — skema lengkap PRD §7:
  `user_strategies`, `journal_entries` (dengan kolom `planned_rr` generated),
  `journal_reason_tags`, `journal_daily_insights`, `analyses`,
  `analysis_daily_insights`. RLS aktif di semua tabel (policy `user_id = auth.uid()`).
- `config.toml` — konfigurasi minimal Supabase CLI (API :54321, DB :54322, Studio :54323).

## Setup lokal

Prasyarat: Docker + [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start            # boot Postgres + Auth + Studio via Docker
supabase db reset         # apply migrations/0001_init.sql ke DB lokal
supabase status           # ambil URL + anon key -> taruh di ../.env.local
```

Untuk project cloud:

```bash
supabase link --project-ref <ref>
supabase db push
```

## Menyambungkan ke frontend

1. `npm i @supabase/supabase-js`
2. Buat `src/lib/supabase.ts` (client dari `import.meta.env.VITE_SUPABASE_*`).
3. Tulis ulang isi fungsi di `src/store/repository.ts` memakai client tersebut —
   nama tabel & kolom sudah sama persis dengan tipe di `src/types.ts`.
