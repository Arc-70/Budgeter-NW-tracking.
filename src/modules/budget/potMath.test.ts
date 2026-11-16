import { describe, expect, it } from 'vitest'
import { computePot, nextPayDate, payDates, weekStartDayFor, type BalanceReset, type BudgetTx, type PayRule } from './potMath'

// 2026-11-16 is a Monday.
const TODAY = '2026-11-16'
const rule = (interval: PayRule['interval'], amount: number, start_date: string, end_date: string | null = null, every = 1): PayRule => ({
  id: start_date + interval, amount, interval, every, start_date, end_date,
})
const tx = (date: string, amount: number, type: 'expense' | 'income' = 'expense', category_id: string | null = null, created_at = date + 'T12:00:00Z'): BudgetTx => ({
  date, amount, type, category_id, created_at,
})
const reset = (date: string, amount: number, created_at = date + 'T08:00:00Z'): BalanceReset => ({ id: date, date, amount, created_at })

describe('payDates', () => {
  it('pays weekly on the same weekday as the start date', () => {
    expect(payDates(rule('weekly', 1500, '2026-11-06'), '2026-11-01', '2026-11-30')).toEqual(['2026-11-06', '2026-11-13', '2026-11-20', '2026-11-27'])
    expect(payDates(rule('weekly', 1500, '2026-10-02'), '2026-11-10', '2026-11-20')).toEqual(['2026-11-13', '2026-11-20'])
  })

  it('pays monthly on the same day of the month, using the last day in short months', () => {
    expect(payDates(rule('monthly', 10000, '2026-11-01'), '2026-11-01', '2027-01-15')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'])
    expect(payDates(rule('monthly', 10000, '2026-01-31'), '2026-02-01', '2026-04-30')).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('can skip periods: every N days, weeks or months', () => {
    expect(payDates(rule('daily', 100, '2026-11-10', null, 3), '2026-11-10', '2026-11-20')).toEqual(['2026-11-10', '2026-11-13', '2026-11-16', '2026-11-19'])
    expect(payDates(rule('daily', 100, '2026-11-10'), '2026-11-14', '2026-11-16')).toEqual(['2026-11-14', '2026-11-15', '2026-11-16'])
    expect(payDates(rule('weekly', 3000, '2026-11-06', null, 2), '2026-11-01', '2026-12-10')).toEqual(['2026-11-06', '2026-11-20', '2026-12-04'])
    expect(payDates(rule('monthly', 30000, '2026-01-15', null, 3), '2026-02-01', '2026-12-31')).toEqual(['2026-04-15', '2026-07-15', '2026-10-15'])
  })

  it('stops at the end date', () => {
    expect(payDates(rule('weekly', 1500, '2026-11-06', '2026-11-13'), '2026-11-01', '2026-11-30')).toEqual(['2026-11-06', '2026-11-13'])
  })
})

describe('nextPayDate', () => {
  it('finds the next payday after today, including for a plan that has not started', () => {
    expect(nextPayDate(rule('weekly', 1500, '2026-11-06'), TODAY)).toBe('2026-11-20')
    expect(nextPayDate(rule('monthly', 10000, '2026-11-01'), TODAY)).toBe('2026-12-01')
    expect(nextPayDate(rule('weekly', 1500, '2027-03-01'), TODAY)).toBe('2027-03-01')
    expect(nextPayDate(rule('weekly', 1500, '2026-11-06', '2026-11-13'), TODAY)).toBeNull()
    expect(nextPayDate(rule('monthly', 30000, '2026-11-01', null, 6), TODAY)).toBe('2027-05-01')
    expect(nextPayDate(rule('daily', 100, '2026-11-10', null, 4), TODAY)).toBe('2026-11-18')
  })
})

describe('computePot', () => {
  it('has no plan until a rule or balance is set', () => {
    expect(computePot([], [], [], 1, TODAY).hasPlan).toBe(false)
  })

  it('combines a monthly lump sum and weekly pay in one pot', () => {
    const rules = [rule('monthly', 10000, '2026-11-01'), rule('weekly', 1500, '2026-11-06')]
    const p = computePot(rules, [], [tx('2026-11-10', 3000), tx('2026-11-14', 500, 'income')], 1, TODAY)
    expect(p.pot).toBe(10000 + 1500 * 2 - 3000 + 500)
    expect(p.nextPays.map((n) => [n.date, n.inDays])).toEqual([['2026-11-20', 4], ['2026-12-01', 15]])
  })

  it('starts counting from "I have this much" and ignores everything before it', () => {
    const rules = [rule('weekly', 1500, '2026-10-02')]
    const txs = [tx('2026-11-01', 9999), tx('2026-11-11', 200)]
    const p = computePot(rules, [reset('2026-11-09', 4000)], txs, 1, TODAY)
    expect(p.pot).toBe(4000 + 1500 - 200) // pay on 13 Nov only
    expect(p.since).toEqual({ date: '2026-11-09', amount: 4000 })
  })

  it('on the day of a reset, only counts what was entered after it', () => {
    const before = tx(TODAY, 100, 'expense', null, TODAY + 'T07:00:00Z')
    const after = tx(TODAY, 40, 'expense', null, TODAY + 'T09:00:00Z')
    expect(computePot([], [reset(TODAY, 1000)], [before, after], 1, TODAY).pot).toBe(960)
  })

  it('carries the pot across a change of plan', () => {
    const rules = [rule('weekly', 1000, '2026-11-02', '2026-11-08'), rule('weekly', 2000, '2026-11-09')]
    expect(computePot(rules, [], [], 1, TODAY).pot).toBe(1000 + 2000 * 2)
  })

  it('reports this week by the weekly payday, and spending per category', () => {
    const rules = [rule('weekly', 1500, '2026-11-06')] // Fridays
    const p = computePot(rules, [], [tx('2026-11-12', 70, 'expense', 'food'), tx('2026-11-13', 100, 'expense', 'food'), tx(TODAY, 50, 'expense', 'food')], 1, TODAY)
    expect([p.weekStart, p.weekEnd]).toEqual(['2026-11-13', '2026-11-19'])
    expect(p.spentThisWeek).toBe(150)
    expect(p.paidThisWeek).toBe(1500)
    expect(p.spentByCategory.get('food')).toBe(150)
  })

  it('tracks spending per category for the calendar month too', () => {
    const p = computePot([], [], [tx('2026-10-31', 999, 'expense', 'bills'), tx('2026-11-02', 400, 'expense', 'bills'), tx(TODAY, 100, 'expense', 'bills')], 1, TODAY)
    expect([p.monthStart, p.monthEnd]).toEqual(['2026-11-01', '2026-11-30'])
    expect(p.spentByCategoryMonth.get('bills')).toBe(500)
    expect(p.spentByCategory.get('bills')).toBe(100)
  })

  it('ignores transactions dated in the future', () => {
    expect(computePot([rule('weekly', 1000, TODAY)], [], [tx('2026-11-20', 300)], 1, TODAY).pot).toBe(1000)
  })
})

describe('weekStartDayFor', () => {
  it('uses the active weekly rule, else the fallback', () => {
    expect(weekStartDayFor([rule('weekly', 1, '2026-11-06')], TODAY, 1)).toBe(5)
    expect(weekStartDayFor([rule('monthly', 1, '2026-11-01')], TODAY, 1)).toBe(1)
    expect(weekStartDayFor([rule('weekly', 1, '2026-11-06', '2026-11-10')], TODAY, 1)).toBe(1)
  })
})
