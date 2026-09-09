// Edge Function: Auto SL/TP + prediction verifier (PRD §4.2 / §4.3).
// Invoked by pg_cron every 5 minutes (see migrations/0002_cron.sql).
//
// Deploy:  supabase functions deploy price-verifier --no-verify-jwt
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  binancePrices,
  checkAnalysis,
  checkTrade,
  realizedPnl,
  realizedRR,
  tradeDirection,
} from '../_shared/logic.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const isCrypto = (p: string) => /USDT$|USDC$|FDUSD$/.test(p)

Deno.serve(async () => {
  const started = Date.now()

  const { data: openTrades = [] } = await admin
    .from('journal_entries')
    .select('*')
    .eq('status', 'open')

  const { data: pendingAnalyses = [] } = await admin
    .from('analyses')
    .select('*')
    .eq('status', 'pending')

  // TODO(Fase 4): resolve IDX stock prices here for asset_type='stock'.
  const cryptoPairs = [
    ...new Set(
      [...openTrades, ...pendingAnalyses]
        .filter((r: any) => r.asset_type === 'crypto' && isCrypto(r.pair))
        .map((r: any) => r.pair),
    ),
  ]
  const prices = await binancePrices(cryptoPairs)

  let closedTrades = 0
  let resolvedPredictions = 0

  for (const t of openTrades as any[]) {
    const price = prices[t.pair]
    if (price == null) continue
    const dir = tradeDirection(Number(t.entry_price), Number(t.take_profit))
    const hit = checkTrade({ ...t, direction: dir }, price)
    if (!hit) continue
    const pnl = realizedPnl(
      { entry_price: Number(t.entry_price), size_amount: Number(t.size_amount), direction: dir },
      hit.exitPrice,
    )
    await admin
      .from('journal_entries')
      .update({
        status: 'closed',
        exit_price: hit.exitPrice,
        realized_pnl: pnl,
        realized_rr: realizedRR(
          { entry_price: Number(t.entry_price), stop_loss: Number(t.stop_loss), direction: dir },
          hit.exitPrice,
        ),
        outcome: pnl > 0 ? 'win' : pnl < 0 ? 'lose' : 'breakeven',
        closed_at: new Date().toISOString(),
      })
      .eq('id', t.id)
    closedTrades++
  }

  for (const a of pendingAnalyses as any[]) {
    const price = prices[a.pair]
    if (price == null) continue
    const status = checkAnalysis(
      { target_price: Number(a.target_price), invalidation_price: Number(a.invalidation_price) },
      price,
    )
    if (!status) continue
    await admin
      .from('analyses')
      .update({ status, resolved_at: new Date().toISOString() })
      .eq('id', a.id)
    resolvedPredictions++
  }

  return Response.json({
    ok: true,
    ms: Date.now() - started,
    checked: { trades: openTrades.length, predictions: pendingAnalyses.length },
    closedTrades,
    resolvedPredictions,
  })
})
