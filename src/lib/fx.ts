// Portfolio-level aggregation needs a single base currency. Per-trade views keep
// their native currency; anything that SUMS across trades normalises to IDR here.
// In production this rate comes from an FX feed; the prototype uses a fixed rate.
import type { Currency } from '../types'

export const BASE_CURRENCY: Currency = 'IDR'

export const FX_TO_IDR: Record<Currency, number> = {
  IDR: 1,
  USD: 16_000,
}

export const toIDR = (amount: number | null | undefined, currency: Currency): number =>
  amount == null ? 0 : amount * FX_TO_IDR[currency]
