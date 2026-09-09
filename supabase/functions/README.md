# Edge Functions

Deno functions — **belum di-deploy**. Struktur & logika final; aktivasi butuh
project Supabase + kredensial.

| Function | Trigger | Tugas |
|---|---|---|
| `price-verifier` | pg_cron tiap 5 menit | Tutup trade open yang menyentuh SL/TP; resolve prediksi pending vs target/invalidation. Harga crypto dari Binance. Saham IDX = `TODO(Fase 4)`. |
| `ai-daily` | pg_cron 17:00 WIB (10:00 UTC) | Per user dengan trade closed `analyzed_by_ai=false`: 1 batch prompt → Claude → upsert `journal_daily_insights` + `journal_reason_tags` → set `analyzed_by_ai=true`. Tak ada trade baru ⇒ user dilewati ⇒ $0. |

`_shared/logic.ts` = salinan sisi-server dari `src/lib/verify.ts` + prompt
(`src/lib/ai/prompt.ts`). Jaga sinkron bila salah satu berubah.

## Deploy

```bash
supabase functions deploy price-verifier --no-verify-jwt
supabase functions deploy ai-daily --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` di-inject otomatis oleh runtime.
Jadwal: jalankan `../migrations/0002_cron.sql` (isi `<PROJECT_REF>` + simpan
service-role key ke Vault sebagai `service_role_key`).

## Test lokal

```bash
supabase functions serve price-verifier
curl -X POST http://localhost:54321/functions/v1/price-verifier
```
