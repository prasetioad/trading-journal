import { describe, it, expect } from 'vitest'
import { isEmpty, sheetsEnabled } from './sheets'
import type { DB } from '../store/repository'

const empty: DB = { strategies: [], journal: [], analyses: [], plans: [] }

describe('sheets helpers', () => {
  it('isEmpty is true only when every collection is empty', () => {
    expect(isEmpty(empty)).toBe(true)
    expect(isEmpty({ ...empty, plans: [{} as never] })).toBe(false)
  })

  it('sheetsEnabled is false without VITE_SHEETS_WEBAPP_URL', () => {
    expect(sheetsEnabled()).toBe(false)
  })
})
