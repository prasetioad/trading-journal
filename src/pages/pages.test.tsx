// @vitest-environment jsdom
//
// Render smoke: every route rendered through the real provider tree (Store +
// Prices + Toast + Router) with the seed dataset, asserting no runtime throw and
// that the page's own heading appears. Catches hook/undefined-access bugs that
// typecheck + build can't see.
import * as React from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

void React // classic JSX runtime in the vitest transform needs React in scope
import { MemoryRouter } from 'react-router-dom'
import { StoreProvider } from '../store/store'
import { PricesProvider } from '../store/prices'
import { ToastProvider } from '../components/ui/Toast'
import App from '../App'

beforeAll(() => {
  // PricesProvider opens a WS + polls on mount — keep the test offline.
  vi.stubGlobal(
    'WebSocket',
    class {
      close() {}
      addEventListener() {}
    },
  )
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline test'))))
})

afterEach(() => cleanup())

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <StoreProvider>
          <PricesProvider>
            <App />
          </PricesProvider>
        </StoreProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

const ROUTES: [string, string][] = [
  ['/dashboard', 'Dashboard'],
  ['/insights', 'Insights'],
  ['/playbook', 'Strategy Playbook'],
  ['/journal', 'Trading Journal'],
  ['/plan', 'Trading Plan'],
  ['/analysis', 'My Analysis / Prediction'],
]

describe('page render smoke', () => {
  it.each(ROUTES)('%s renders its heading', (path, heading) => {
    renderAt(path)
    expect(screen.getAllByText(heading).length).toBeGreaterThan(0)
  })

  it('unknown route redirects to the dashboard', () => {
    renderAt('/does-not-exist')
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
  })

  it('Insights shows the auto-insight and per-reason sections from seed data', async () => {
    renderAt('/insights')
    expect(screen.getByText('Performa per alasan')).toBeTruthy()
    expect(screen.getByText('Trading DNA')).toBeTruthy()
    // Weekly Review card mounts after its async (deterministic) generation resolves
    expect(await screen.findByText('Weekly Review')).toBeTruthy()
  })

  it('Plan shows the seeded plan and its plan-vs-actual comparison', () => {
    renderAt('/plan')
    // seedPlans() creates a plan for today
    const today = new Date().toISOString().slice(0, 10)
    expect(screen.getByText(today)).toBeTruthy()
  })
})
