// localStorage-backed repository. This is the ONLY module that knows about
// persistence — replace the bodies with Supabase calls (same signatures) to go
// live. Table shapes match /supabase/migrations/0001_init.sql + 0003_roadmapv2.sql.
import type { Analysis, JournalEntry, Strategy, TradingPlan } from '../types'
import { seedAnalyses, seedJournal, seedPlans, seedStrategies } from '../data/seed'

const KEY = 'tj.cockpit.v1'

interface DB {
  strategies: Strategy[]
  journal: JournalEntry[]
  analyses: Analysis[]
  plans: TradingPlan[]
}

/** Backfill fields added after a DB was first written (Roadmap V2 A0). */
function migrate(db: Partial<DB>): DB {
  return {
    strategies: db.strategies ?? [],
    analyses: db.analyses ?? [],
    plans: db.plans ?? [],
    journal: (db.journal ?? []).map((t) => ({
      ...t,
      mode: t.mode ?? 'live',
      entry_at: t.entry_at ?? t.created_at,
      planned_entry: t.planned_entry ?? null,
      setup_tags: t.setup_tags ?? [],
      market_condition: t.market_condition ?? null,
      confidence: t.confidence ?? null,
      risk_pct: t.risk_pct ?? null,
      screenshot_ref: t.screenshot_ref ?? null,
      mistakes: t.mistakes ?? [],
    })),
  }
}

function seeded(): DB {
  return {
    strategies: seedStrategies(),
    journal: seedJournal(),
    analyses: seedAnalyses(),
    plans: seedPlans(),
  }
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return migrate(JSON.parse(raw) as Partial<DB>)
  } catch {
    /* ignore corrupt / unavailable storage */
  }
  const fresh = seeded()
  save(fresh)
  return fresh
}

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

export const repository = {
  read(): DB {
    return load()
  },
  write(db: DB) {
    save(db)
  },
  reset(): DB {
    const fresh = seeded()
    save(fresh)
    return fresh
  },
  clear(): DB {
    const empty: DB = { strategies: [], journal: [], analyses: [], plans: [] }
    save(empty)
    return empty
  },
}

export type { DB }
