import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Analysis, JournalEntry, Strategy, TradeMode, TradingPlan } from '../types'
import { repository, type DB } from './repository'
import { uid } from '../lib/format'
import { applyTradeEdit, direction, outcomeOf, realizedPnl, realizedRR } from '../lib/finance'
import { isEmpty, readAll, sheetsEnabled, writeAll } from '../lib/sheets'

export type SyncStatus = 'off' | 'loading' | 'synced' | 'saving' | 'error'

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
  | 'mode'
  | 'analyzed_by_ai'
  | 'analyzed_at'
  | 'closed_at'
  | 'created_at'
> & { entry_at?: string; mode?: TradeMode }
type AnalysisInput = Omit<
  Analysis,
  'id' | 'status' | 'resolved_at' | 'analyzed_by_ai' | 'created_at'
>
type PlanInput = Omit<TradingPlan, 'id' | 'created_at'>

interface StoreValue {
  strategies: Strategy[]
  /** live trades only — every real-money view uses this */
  journal: JournalEntry[]
  /** Backtest Lab trades only */
  backtestJournal: JournalEntry[]
  /** live + backtest — only the Strategy League Table / Playbook use this */
  allJournal: JournalEntry[]
  analyses: Analysis[]
  plans: TradingPlan[]
  // strategies
  addStrategy: (s: StrategyInput) => void
  updateStrategy: (id: string, patch: Partial<StrategyInput>) => void
  deleteStrategy: (id: string) => void
  // journal
  addTrade: (t: JournalInput) => void
  addTrades: (ts: JournalInput[]) => void
  updateTrade: (id: string, patch: Partial<JournalEntry>) => void
  closeTrade: (id: string, exitPrice: number, extra?: { mistakes?: string[] }) => void
  reopenTrade: (id: string) => void
  deleteTrade: (id: string) => void
  markAnalyzed: (ids: string[]) => void
  // analyses
  addAnalysis: (a: AnalysisInput) => void
  resolveAnalysis: (id: string, status: 'success' | 'fail' | 'pending') => void
  deleteAnalysis: (id: string) => void
  // plans
  addPlan: (p: PlanInput) => void
  updatePlan: (id: string, patch: Partial<PlanInput>) => void
  deletePlan: (id: string) => void
  // admin
  resetDemo: () => void
  clearAll: () => void
  // sync (Google Sheets backend, when VITE_SHEETS_WEBAPP_URL is set)
  sync: { status: SyncStatus; error: string | null; lastSync: number | null; pushNow: () => void }
}

const Ctx = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(() => repository.read())

  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    sheetsEnabled() ? 'loading' : 'off',
  )
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dbRef = useRef(db)
  dbRef.current = db

  const pushRemote = useMemo(
    () => async () => {
      if (!sheetsEnabled()) return
      setSyncStatus('saving')
      try {
        await writeAll(dbRef.current)
        setSyncStatus('synced')
        setSyncError(null)
        setLastSync(Date.now())
      } catch (e) {
        setSyncStatus('error')
        setSyncError(e instanceof Error ? e.message : String(e))
      }
    },
    [],
  )

  const commit = (next: DB) => {
    repository.write(next) // local cache, always
    setDb(next)
    if (sheetsEnabled()) {
      if (pushTimer.current) clearTimeout(pushTimer.current)
      pushTimer.current = setTimeout(() => void pushRemote(), 1500)
    }
  }

  // On boot: pull from the Sheet. If the Sheet is empty, seed it from local.
  useEffect(() => {
    if (!sheetsEnabled()) return
    let alive = true
    ;(async () => {
      try {
        const remote = await readAll()
        if (!alive) return
        if (isEmpty(remote)) {
          await writeAll(dbRef.current) // first run — populate the Sheet from local
        } else {
          // screenshots live only in the browser — re-attach them by trade id
          const shots = new Map(
            dbRef.current.journal
              .filter((t) => t.screenshot_ref)
              .map((t) => [t.id, t.screenshot_ref]),
          )
          const merged: DB = {
            ...remote,
            journal: remote.journal.map((t) =>
              shots.has(t.id) ? { ...t, screenshot_ref: shots.get(t.id)! } : t,
            ),
          }
          repository.write(merged)
          setDb(merged)
        }
        setSyncStatus('synced')
        setSyncError(null)
        setLastSync(Date.now())
      } catch (e) {
        if (!alive) return
        setSyncStatus('error')
        setSyncError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const value = useMemo<StoreValue>(() => {
    const now = () => new Date().toISOString()

    const mkTrade = (t: JournalInput): JournalEntry => ({
      ...t,
      id: uid(),
      direction: direction(t.entry_price, t.take_profit),
      exit_price: null,
      realized_pnl: null,
      realized_rr: null,
      status: 'open',
      outcome: null,
      mode: t.mode ?? 'live',
      analyzed_by_ai: false,
      analyzed_at: null,
      closed_at: null,
      created_at: now(),
      entry_at: t.entry_at ?? now(),
    })

    const liveJournal = db.journal.filter((t) => t.mode !== 'backtest')
    const backtestJournal = db.journal.filter((t) => t.mode === 'backtest')

    return {
      strategies: db.strategies,
      journal: liveJournal,
      backtestJournal,
      allJournal: db.journal,
      analyses: db.analyses,
      plans: db.plans,

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

      addTrade: (t) => commit({ ...db, journal: [mkTrade(t), ...db.journal] }),

      addTrades: (ts) =>
        commit({ ...db, journal: [...ts.map(mkTrade), ...db.journal] }),

      updateTrade: (id, patch) =>
        commit({
          ...db,
          journal: db.journal.map((t) => (t.id === id ? applyTradeEdit(t, patch) : t)),
        }),

      closeTrade: (id, exitPrice, extra) =>
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
              mistakes: extra?.mistakes ?? t.mistakes,
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

      addPlan: (p) =>
        commit({
          ...db,
          plans: [
            { ...p, id: uid(), created_at: now() },
            ...db.plans.filter((x) => x.plan_date !== p.plan_date),
          ],
        }),

      updatePlan: (id, patch) =>
        commit({
          ...db,
          plans: db.plans.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        }),

      deletePlan: (id) => commit({ ...db, plans: db.plans.filter((x) => x.id !== id) }),

      resetDemo: () => commit(repository.reset()),
      clearAll: () => commit(repository.clear()),

      sync: {
        status: syncStatus,
        error: syncError,
        lastSync,
        pushNow: () => void pushRemote(),
      },
    }
  }, [db, syncStatus, syncError, lastSync, pushRemote])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore must be used within StoreProvider')
  return v
}
