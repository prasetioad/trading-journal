import { describe, expect, it } from 'vitest'
import { reconcileCollection } from './store'

// Regression test for the Google Sheets boot-sync race: creating something
// (e.g. a Strategy, then a Journal entry) in the first second or two after
// load — before the initial readAll() resolves — used to get silently wiped
// when that stale remote snapshot overwrote local state. See store.tsx.

type Row = { id: string; v: string }

describe('reconcileCollection (sync-race reconciliation)', () => {
  it('returns remote unchanged when nothing changed locally during the pull', () => {
    const before: Row[] = [{ id: 'a', v: '1' }]
    const now: Row[] = [{ id: 'a', v: '1' }]
    const remote: Row[] = [{ id: 'a', v: 'remote-1' }, { id: 'b', v: 'remote-only' }]
    expect(reconcileCollection(remote, before, now)).toEqual(remote)
  })

  it('keeps an item created locally while the pull was in flight, even though remote does not have it yet', () => {
    const before: Row[] = []
    const now: Row[] = [{ id: 'new-strategy', v: 'Orderflow strategy' }]
    const remote: Row[] = [] // the Sheet, as it was before the strategy was created

    const merged = reconcileCollection(remote, before, now)
    expect(merged).toContainEqual({ id: 'new-strategy', v: 'Orderflow strategy' })
  })

  it('keeps a chain of local additions (strategy, then a journal trade referencing it)', () => {
    const before: Row[] = []
    const afterStrategy: Row[] = [{ id: 's1', v: 'Orderflow strategy' }]
    const afterTrade: Row[] = [...afterStrategy, { id: 't1', v: 'BTCUSDT trade' }]
    const remote: Row[] = [] // stale — captured before either existed

    const merged = reconcileCollection(remote, before, afterTrade)
    expect(merged.map((r) => r.id).sort()).toEqual(['s1', 't1'])
  })

  it('local edit wins over the remote value for the same id', () => {
    const before: Row[] = [{ id: 'a', v: 'open' }]
    const now: Row[] = [{ id: 'a', v: 'closed-locally' }]
    const remote: Row[] = [{ id: 'a', v: 'open' }] // hasn't seen the close yet

    const merged = reconcileCollection(remote, before, now)
    expect(merged).toEqual([{ id: 'a', v: 'closed-locally' }])
  })

  it('untouched ids still defer to remote (so edits made elsewhere are not lost)', () => {
    const before: Row[] = [{ id: 'a', v: '1' }]
    const now: Row[] = [{ id: 'a', v: '1' }] // untouched locally
    const remote: Row[] = [{ id: 'a', v: 'edited-on-another-device' }]

    const merged = reconcileCollection(remote, before, now)
    expect(merged).toEqual([{ id: 'a', v: 'edited-on-another-device' }])
  })
})
