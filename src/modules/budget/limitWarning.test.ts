import { describe, expect, it } from 'vitest'
import { overLimitBy, type WeekSpending } from './limitWarning'

const spending: WeekSpending = { weekStart: '2026-11-16', weekEnd: '2026-11-22', spentByCategory: new Map([['food', 1450]]) }
const food = { id: 'food', name: 'Food', weekly_limit: 1500 }

describe('overLimitBy', () => {
  it('says how far over the limit an expense would go', () => {
    expect(overLimitBy(spending, food, 120, '2026-11-16')).toBe(70)
    expect(overLimitBy(spending, food, 50, '2026-11-16')).toBe(0)
  })

  it('stays quiet for other weeks, no limit, or no category', () => {
    expect(overLimitBy(spending, food, 120, '2026-11-10')).toBe(0)
    expect(overLimitBy(spending, { ...food, weekly_limit: null }, 120, '2026-11-16')).toBe(0)
    expect(overLimitBy(spending, undefined, 120, '2026-11-16')).toBe(0)
    expect(overLimitBy(null, food, 120, '2026-11-16')).toBe(0)
  })
})
