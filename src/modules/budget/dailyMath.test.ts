import { describe, expect, it } from 'vitest'
import { computeDailyPool, overDailyBy, ruleRateOn } from './dailyMath'
import type { BudgetTx, PayRule } from './potMath'

const rule = (interval: PayRule['interval'], amount: number, start_date: string, every = 1, end_date: string | null = null): PayRule => ({
  id: interval + start_date, amount, interval, every, start_date, end_date,
})
const tx = (date: string, amount: number, type: 'expense' | 'income' = 'expense'): BudgetTx => ({
  date, amount, type, category_id: null, created_at: date + 'T12:00:00Z',
})

describe('ruleRateOn', () => {
  it('spreads each pay line over the days it covers', () => {
    expect(ruleRateOn(rule('weekly', 2500, '2026-10-30'), '2026-11-18')).toBeCloseTo(357.14, 2) // the 2.5k example
    expect(ruleRateOn(rule('weekly', 3000, '2026-10-30', 2), '2026-11-18')).toBeCloseTo(214.29, 2)
    expect(ruleRateOn(rule('daily', 300, '2026-11-01', 3), '2026-11-18')).toBe(100)
    expect(ruleRateOn(rule('monthly', 2000, '2026-11-01'), '2026-11-18')).toBeCloseTo(66.67, 2) // 30-day November
    expect(ruleRateOn(rule('monthly', 2000, '2026-11-01'), '2026-12-05')).toBeCloseTo(64.52, 2) // 31-day December
    expect(ruleRateOn(rule('monthly', 2800, '2026-01-31'), '2026-02-10')).toBe(100) // 31 Jan to 28 Feb
  })

  it('pays nothing before the start or after the end', () => {
    expect(ruleRateOn(rule('weekly', 700, '2026-11-20'), '2026-11-18')).toBe(0)
    expect(ruleRateOn(rule('weekly', 700, '2026-11-01', 1, '2026-11-10'), '2026-11-18')).toBe(0)
  })
})

describe('computeDailyPool', () => {
  // The worked example: 2,000 monthly on the 1st + 1,000 weekly, in a 30-day month.
  const rules = [rule('monthly', 2000, '2026-11-01'), rule('weekly', 1000, '2026-10-30')]

  it('gives 209.52 a day and 6,285.71 for the month', () => {
    const pool = computeDailyPool(rules, [], '2026-11-01')
    expect(pool.ratePerDay).toBeCloseTo(209.52, 2)
    expect(pool.monthTotal).toBeCloseTo(6285.71, 2)
    expect(pool.available).toBeCloseTo(209.52, 2)
  })

  it('carries unspent money into the next day', () => {
    const pool = computeDailyPool(rules, [tx('2026-11-01', 100)], '2026-11-02')
    expect(pool.carried).toBeCloseTo(109.52, 2)
    expect(pool.available).toBeCloseTo(319.05, 2)
  })

  it('carries overspending forward as a shortfall, and counts income as nothing', () => {
    const pool = computeDailyPool(rules, [tx('2026-11-01', 500), tx('2026-11-02', 50), tx('2026-11-02', 999, 'income')], '2026-11-02')
    expect(pool.carried).toBeCloseTo(-290.48, 2)
    expect(pool.spentToday).toBe(50)
    expect(pool.available).toBeCloseTo(-130.95, 2)
  })

  it('starts fresh on the 1st', () => {
    const pool = computeDailyPool(rules, [tx('2026-10-31', 5000)], '2026-11-01')
    expect(pool.carried).toBe(0)
  })
})

describe('overDailyBy', () => {
  const pool = computeDailyPool([rule('daily', 200, '2026-11-01')], [tx('2026-11-18', 150)], '2026-11-18') // 3,450 available
  it('warns only when an expense goes past what is available', () => {
    expect(overDailyBy(pool, 3000, '2026-11-18', '2026-11-18')).toBe(0)
    expect(overDailyBy(pool, 3500, '2026-11-18', '2026-11-18')).toBe(50)
    expect(overDailyBy(pool, 3500, '2026-10-30', '2026-11-18')).toBe(0) // last month
  })
})
