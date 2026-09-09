import { describe, it, expect } from 'vitest'
import { isEmpty, sheetsEnabled } from './sheets'
import type { DB } from '../store/repository'

const empty: DB = { strategies: [], journal: [], analyses: [], plans: [] }

describe('sheets helpers', () => {
  it('isEmpty is true only when every collection is empty', () => {
    expect(isEmpty(empty)).toBe(true)
    expect(isEmpty({ ...empty, plans: [{} as never] })).toBe(false)
  })

  it('sheetsEnabled returns a boolean that matches the configured URL', () => {
    const url = (import.meta.env.VITE_SHEETS_WEBAPP_URL as string | undefined)?.trim() || ''
    const expected = /\/macros\/s\//.test(url) || /^https:\/\/script\.google(usercontent)?\.com\//.test(url)
    expect(sheetsEnabled()).toBe(expected)
  })
})
