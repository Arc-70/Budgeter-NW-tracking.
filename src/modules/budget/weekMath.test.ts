import { describe, expect, it } from 'vitest'
import { computeWeek, limitStatus, payForWeek, weekStartOf, type BudgetTx } from './weekMath'

// 2026-11-16 is a Monday.
const pay = [{ effective_from: '2026-11-02', amount: 5000 }]
const tx = (date: string, amount: number, type: 'expense' | 'income' = 'expense', category_id: string | null = null): BudgetTx => ({
  date, amount, type, category_id,
})

describe('weekStartOf', () => {
  it('finds the start of the week for any payday', () => {
    expect(weekStartOf('2026-11-18', 1)).toBe('2026-11-16') // Monday weeks
    expect(weekStartOf('2026-11-16', 1)).toBe('2026-11-16')
    expect(weekStartOf('2026-11-18', 5)).toBe('2026-11-13') // Friday weeks
  })
})

describe('computeWeek', () => {
  it('returns null until a weekly pay is set', () => {
    expect(computeWeek([], [], 1, '2026-11-16')).toBeNull()
  })

  it('rolls unspent money into the next week', () => {
    const txs = [tx('2026-11-03', 4000), tx('2026-11-10', 5360), tx('2026-11-16', 2870)]
    const w = computeWeek(pay, txs, 1, '2026-11-19')!
    expect(w.rolledOver).toBe(640) // (5000-4000) + (5000-5360)
    expect(w.spent).toBe(2870)
    expect(w.left).toBe(2770)
    expect(w.daysLeft).toBe(4)
  })

  it('carries overspending forward as a negative rollover', () => {
    const w = computeWeek(pay, [tx('2026-11-10', 6000)], 1, '2026-11-16')!
    expect(w.rolledOver).toBe(4000) // 5000 + (5000-6000)
    const first = computeWeek(pay, [tx('2026-11-02', 6000)], 1, '2026-11-09')!
    expect(first.rolledOver).toBe(-1000)
  })

  it('adds extra income to the pot and tracks spending per category', () => {
    const txs = [tx('2026-11-16', 300, 'income'), tx('2026-11-16', 100, 'expense', 'food'), tx('2026-11-17', 50, 'expense', 'food')]
    const w = computeWeek([{ effective_from: '2026-11-16', amount: 5000 }], txs, 1, '2026-11-17')!
    expect(w.left).toBe(5150)
    expect(w.spentByCategory.get('food')).toBe(150)
  })

  it('uses the new amount from the week a pay change starts', () => {
    const changes = [...pay, { effective_from: '2026-11-16', amount: 6000 }]
    expect(payForWeek(changes, '2026-11-09')).toBe(5000)
    expect(payForWeek(changes, '2026-11-16')).toBe(6000)
    expect(computeWeek(changes, [], 1, '2026-11-16')!.left).toBe(16000)
  })

  it('ignores transactions from before tracking started', () => {
    expect(computeWeek(pay, [tx('2026-10-20', 999)], 1, '2026-11-02')!.left).toBe(5000)
  })
})

describe('limitStatus', () => {
  it('warns near the limit and flags going over', () => {
    expect(limitStatus(100, 500)).toBe('ok')
    expect(limitStatus(450, 500)).toBe('near')
    expect(limitStatus(700, 500)).toBe('over')
    expect(limitStatus(700, null)).toBe('ok')
  })
})
