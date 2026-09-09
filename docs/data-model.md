# Data Model — Trading Journal V2

Domain types live in [src/types.ts](../src/types.ts); persistence shapes match
`supabase/migrations/0001_init.sql` + `0003_roadmapv2.sql`. The running app stores
these in `localStorage` via [src/store/repository.ts](../src/store/repository.ts);
[repository.supabase.ts](../src/store/repository.supabase.ts) is the row-level
async equivalent for Track B.

---

## `JournalEntry`

| Field | Type | Source | Notes |
|---|---|---|---|
| `id` | string (uuid) | system | |
| `asset_type` | `'crypto' \| 'stock'` | form | drives price source |
| `pair` | string | form | `BTCUSDT`, `BBCA` |
| `strategy_id` | string \| null | form | null = "Tanpa Strategi / Eksperimen" |
| `followed_plan` | boolean | form | SOP adherence toggle |
| `size_amount` / `size_currency` | number / `'IDR' \| 'USD'` | form | notional exposure at entry |
| `entry_price` / `take_profit` / `stop_loss` | number | form | |
| `direction` | `'long' \| 'short'` | derived | `tp >= entry ? long : short` |
| `exit_price` / `realized_pnl` / `realized_rr` | number \| null | close | |
| `status` | `'open' \| 'closed'` | lifecycle | |
| `outcome` | `'win' \| 'lose' \| 'breakeven'` \| null | close | |
| `psychology` | fixed list | form | one of `PSYCHOLOGY` |
| `reasoning` | string | form | freetext, read by AI |
| `analyzed_by_ai` / `analyzed_at` | boolean / string \| null | AI batch | |
| `closed_at` | string \| null | lifecycle | exit timestamp |
| `created_at` | string | system | record creation |
| **`entry_at`** | string | form | when the position was entered (≠ `created_at`); powers session/hour analytics |
| **`planned_entry`** | number \| null | form | price the plan called for → late/early-entry detection |
| **`setup_tags`** | string[] | form | e.g. `['Breakout','Retest']`; powers per-setup analytics |
| **`market_condition`** | `MarketCondition` \| null | form | one of `MARKET_CONDITIONS` |
| **`confidence`** | number (1–10) \| null | form | self-rated conviction |
| **`risk_pct`** | number \| null | form | risk as % of equity → risk-creep detection |
| **`screenshot_ref`** | string \| null | upload | data: URL (prototype) or Storage path |
| **`mistakes`** | string[] | form/close | tags from `MISTAKE_TAGS` |

Bold rows are Roadmap V2 A0 additions. All are nullable / defaulted, so pre-V2
rows load unchanged ([repository.ts `migrate()`](../src/store/repository.ts)).

### Example payload

```jsonc
{
  "id": "6f1c…",
  "asset_type": "crypto",
  "pair": "BTCUSDT",
  "strategy_id": "seed-strat-breakout",
  "followed_plan": true,
  "size_amount": 1000, "size_currency": "USD",
  "entry_price": 61000, "take_profit": 64000, "stop_loss": 60000,
  "direction": "long",
  "exit_price": 64000, "realized_pnl": 49.18, "realized_rr": 3, "outcome": "win",
  "status": "closed",
  "psychology": "Percaya diri",
  "reasoning": "Break weekly resistance 60.8k, retest bersih, volume ekspansi.",
  "entry_at": "2026-08-10T07:12:00.000Z",
  "planned_entry": 60800,
  "setup_tags": ["Breakout", "Retest"],
  "market_condition": "Trending",
  "confidence": 8,
  "risk_pct": 1,
  "screenshot_ref": null,
  "mistakes": [],
  "analyzed_by_ai": true, "analyzed_at": "…", "closed_at": "…", "created_at": "…"
}
```

---

## `TradingPlan` (Roadmap V2 A5)

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `plan_date` | string `YYYY-MM-DD` | unique per user; one plan per day |
| `bias` | `'bullish' \| 'bearish' \| 'neutral'` | |
| `key_levels` | number[] | watch prices |
| `allowed_setups` | string[] | subset of `SETUP_TAGS` |
| `max_trades` | number | plan-vs-actual overtrading check |
| `max_daily_loss_r` | number | stop-out in R multiples |
| `no_trade_rules` | string[] | e.g. "Major news dalam 30 menit" |
| `notes` | string | |
| `created_at` | string | |

**Plan vs Actual** ([src/features/plan](../src/features/plan)) joins `trading_plans.plan_date`
to journal entries whose `entry_at` falls on that date, then flags:
trade count > `max_trades`, realized loss (R) beyond `max_daily_loss_r`,
`setup_tags` outside `allowed_setups`, avg `risk_pct` drift.

---

## Derived / analytics (not stored)

Computed on read from `JournalEntry[]`:

- [src/lib/finance.ts](../src/lib/finance.ts) — R:R, Expectancy, Profit Factor, Equity Curve, Discipline, Emotional Leak.
- [src/lib/analytics.ts](../src/lib/analytics.ts) — by hour / session / weekday / setup tag / market condition; streaks; drawdown; Trading DNA.
- [src/lib/rules.ts](../src/lib/rules.ts) — behavioral flags (revenge, risk-creep, overtrading, late entry, cut-profit-early); per-trade discipline score; `autoInsights()`.

## Supabase tables touched

| Table | Migration |
|---|---|
| `journal_entries` (+ 8 columns, `entry_at` index) | `0003_roadmapv2.sql` |
| `trading_plans` (new, RLS per-user) | `0003_roadmapv2.sql` |
