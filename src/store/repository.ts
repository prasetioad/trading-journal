// localStorage-backed repository. This is the ONLY module that knows about
// persistence — replace the bodies with Supabase calls (same signatures) to go
// live. Table shapes match /supabase/migrations/0001_init.sql.
import type { Analysis, JournalEntry, Strategy } from '../types'
import { seedAnalyses, seedJournal, seedStrategies } from '../data/seed'

const KEY = 'tj.cockpit.v1'

interface DB {
  strategies: Strategy[]
  journal: JournalEntry[]
  analyses: Analysis[]
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DB
  } catch {
    /* ignore corrupt / unavailable storage */
  }
  const seeded: DB = {
    strategies: seedStrategies(),
    journal: seedJournal(),
    analyses: seedAnalyses(),
  }
  save(seeded)
  return seeded
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
    const fresh: DB = {
      strategies: seedStrategies(),
      journal: seedJournal(),
      analyses: seedAnalyses(),
    }
    save(fresh)
    return fresh
  },
  clear(): DB {
    const empty: DB = { strategies: [], journal: [], analyses: [] }
    save(empty)
    return empty
  },
}

export type { DB }
