import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Analysis, JournalEntry, Strategy } from '../types'
import { repository, type DB } from './repository'
import { uid } from '../lib/format'
import { direction, outcomeOf, realizedPnl, realizedRR } from '../lib/finance'

type StrategyInput = Pick<Strategy, 'name' | 'description' | 'target_sample_size' | 'status'>
type JournalInput = Omit<
  JournalEntry,
  | 'id'
  | 'direction'
  | 'exit_price'
  | 'realized_pnl'
  | 'realized_rr'
  | 'status'
  | 'outcome'
  | 'analyzed_by_ai'
  | 'analyzed_at'
  | 'closed_at'
  | 'created_at'
>
type AnalysisInput = Omit<
  Analysis,
  'id' | 'status' | 'resolved_at' | 'analyzed_by_ai' | 'created_at'
>

interface StoreValue {
  strategies: Strategy[]
  journal: JournalEntry[]
  analyses: Analysis[]
  // strategies
  addStrategy: (s: StrategyInput) => void
  updateStrategy: (id: string, patch: Partial<StrategyInput>) => void
  deleteStrategy: (id: string) => void
  // journal
  addTrade: (t: JournalInput) => void
  closeTrade: (id: string, exitPrice: number) => void
  reopenTrade: (id: string) => void
  deleteTrade: (id: string) => void
  markAnalyzed: (ids: string[]) => void
  // analyses
  addAnalysis: (a: AnalysisInput) => void
  resolveAnalysis: (id: string, status: 'success' | 'fail' | 'pending') => void
  deleteAnalysis: (id: string) => void
  // admin
  resetDemo: () => void
  clearAll: () => void
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => repository.read())

  const commit = (next: DB) => {
    repository.write(next)
    setDb(next)
  }

  const value = useMemo<StoreValue>(() => {
    const now = () => new Date().toISOString()

    return {
      strategies: db.strategies,
      journal: db.journal,
      analyses: db.analyses,

      addStrategy: (s) =>
        commit({
          ...db,
          strategies: [
            { ...s, id: uid(), created_at: now(), updated_at: now() },
            ...db.strategies,
          ],
        }),

      updateStrategy: (id, patch) =>
        commit({
          ...db,
          strategies: db.strategies.map((x) =>
            x.id === id ? { ...x, ...patch, updated_at: now() } : x,
          ),
        }),

      deleteStrategy: (id) =>
        commit({
          ...db,
          strategies: db.strategies.filter((x) => x.id !== id),
          journal: db.journal.map((t) =>
            t.strategy_id === id ? { ...t, strategy_id: null } : t,
          ),
        }),

      addTrade: (t) =>
        commit({
          ...db,
          journal: [
            {
              ...t,
              id: uid(),
              direction: direction(t.entry_price, t.take_profit),
              exit_price: null,
              realized_pnl: null,
              realized_rr: null,
              status: 'open',
              outcome: null,
              analyzed_by_ai: false,
              analyzed_at: null,
              closed_at: null,
              created_at: now(),
            },
            ...db.journal,
          ],
        }),

      closeTrade: (id, exitPrice) =>
        commit({
          ...db,
          journal: db.journal.map((t) => {
            if (t.id !== id) return t
            const pnl = realizedPnl(t, exitPrice)
            return {
              ...t,
              status: 'closed',
              exit_price: exitPrice,
              realized_pnl: pnl,
              realized_rr: realizedRR(t, exitPrice),
              outcome: outcomeOf(pnl),
              closed_at: now(),
            }
          }),
        }),

      reopenTrade: (id) =>
        commit({
          ...db,
          journal: db.journal.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: 'open',
                  exit_price: null,
                  realized_pnl: null,
                  realized_rr: null,
                  outcome: null,
                  closed_at: null,
                }
              : t,
          ),
        }),

      deleteTrade: (id) =>
        commit({ ...db, journal: db.journal.filter((t) => t.id !== id) }),

      markAnalyzed: (ids) => {
        if (!ids.length) return
        const set = new Set(ids)
        commit({
          ...db,
          journal: db.journal.map((t) =>
            set.has(t.id) ? { ...t, analyzed_by_ai: true, analyzed_at: now() } : t,
          ),
        })
      },

      addAnalysis: (a) =>
        commit({
          ...db,
          analyses: [
            {
              ...a,
              id: uid(),
              status: 'pending',
              resolved_at: null,
              analyzed_by_ai: false,
              created_at: now(),
            },
            ...db.analyses,
          ],
        }),

      resolveAnalysis: (id, status) =>
        commit({
          ...db,
          analyses: db.analyses.map((x) =>
            x.id === id
              ? { ...x, status, resolved_at: status === 'pending' ? null : now() }
              : x,
          ),
        }),

      deleteAnalysis: (id) =>
        commit({ ...db, analyses: db.analyses.filter((x) => x.id !== id) }),

      resetDemo: () => commit(repository.reset()),
      clearAll: () => commit(repository.clear()),
    }
  }, [db])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
