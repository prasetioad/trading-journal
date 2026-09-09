// Temporary storage backend: a Google Sheet, reached through an Apps Script
// Web App (see google-apps-script/Code.gs + docs/google-sheets-storage.md).
//
// The app keeps localStorage as an instant offline cache; the Sheet is the
// durable store. On boot we pull from the Sheet; every mutation is pushed back
// (debounced) as a full snapshot. Requests use a text/plain body and no custom
// headers so the browser makes a "simple" CORS request the Web App can answer.
import type { DB } from '../store/repository'

const URL = (import.meta.env.VITE_SHEETS_WEBAPP_URL as string | undefined)?.trim() || ''

export function sheetsEnabled(): boolean {
  return /^https:\/\/script\.google(usercontent)?\.com\//.test(URL) || /\/macros\/s\//.test(URL)
}

export function sheetsTarget(): string {
  return URL
}

function normalize(raw: unknown): DB {
  const o = (raw ?? {}) as Partial<DB>
  return {
    strategies: Array.isArray(o.strategies) ? o.strategies : [],
    journal: (Array.isArray(o.journal) ? o.journal : []).map((t) => ({
      ...t,
      mode: t.mode === 'backtest' ? 'backtest' : 'live',
      setup_tags: t.setup_tags ?? [],
      mistakes: t.mistakes ?? [],
      entry_at: t.entry_at ?? t.created_at,
    })),
    analyses: Array.isArray(o.analyses) ? o.analyses : [],
    plans: Array.isArray(o.plans) ? o.plans : [],
  }
}

export function isEmpty(db: DB): boolean {
  return !db.strategies.length && !db.journal.length && !db.analyses.length && !db.plans.length
}

/** Pull the whole dataset from the Sheet. Throws on transport/HTTP error. */
export async function readAll(): Promise<DB> {
  const res = await fetch(URL, { method: 'GET', redirect: 'follow' })
  if (!res.ok) throw new Error(`Sheets GET ${res.status}`)
  const json = await res.json()
  if (json && json.error) throw new Error(`Sheets: ${json.error}`)
  return normalize(json)
}

/** Screenshots (data: URLs) stay on-device; never pushed to the Sheet. */
function stripShots(db: DB): DB {
  return {
    ...db,
    journal: db.journal.map((t) =>
      t.screenshot_ref?.startsWith('data:') ? { ...t, screenshot_ref: null } : t,
    ),
  }
}

/** Overwrite the whole dataset in the Sheet. Throws on transport/HTTP error. */
export async function writeAll(db: DB): Promise<void> {
  const res = await fetch(URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'content-type': 'text/plain;charset=utf-8' }, // "simple" request — no preflight
    body: JSON.stringify({ action: 'writeAll', db: stripShots(db) }),
  })
  if (!res.ok) throw new Error(`Sheets POST ${res.status}`)
  const json = await res.json().catch(() => ({}))
  if (json && json.error) throw new Error(`Sheets: ${json.error}`)
}
