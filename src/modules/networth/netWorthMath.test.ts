import { describe, expect, it } from 'vitest'
import { buildHistory, historyDates, series, summarize, type NwAccount, type NwBalance, type NwCategory, type Snapshot } from './netWorthMath'

const categories: NwCategory[] = [
  { id: 'bank', name: 'Bank and cash', kind: 'asset' },
  { id: 'inv', name: 'Investments', kind: 'asset' },
  { id: 'debt', name: 'Debts', kind: 'liability' },
]
const accounts: NwAccount[] = [
  { id: 'a1', name: 'Savings', category_id: 'bank', currency: 'THB', closed_on: null },
  { id: 'a2', name: 'US brokerage', category_id: 'inv', currency: 'USD', closed_on: null },
  { id: 'a3', name: 'Credit card', category_id: 'debt', currency: 'THB', closed_on: null },
  { id: 'a4', name: 'Empty', category_id: 'bank', currency: 'THB', closed_on: null },
]
const balances: NwBalance[] = [
  { account_id: 'a1', date: '2026-10-01', balance: 100000 },
  { account_id: 'a1', date: '2026-11-01', balance: 120000 },
  { account_id: 'a2', date: '2026-10-01', balance: 2000 },
  { account_id: 'a3', date: '2026-11-01', balance: 50000 },
]

describe('summarize', () => {
  it('uses the latest balance, converts USD and subtracts debts', () => {
    const s = summarize(categories, accounts, balances, 32.5)
    expect(s.total).toBe(120000 + 65000 - 50000)
    expect(s.byCategory.map((c) => [c.category.id, c.total])).toEqual([['bank', 120000], ['inv', 65000], ['debt', -50000]])
  })

  it('shows accounts that were never updated as empty', () => {
    const row = summarize(categories, accounts, balances, 32.5).accounts.find((r) => r.account.id === 'a4')!
    expect(row.balance).toBeNull()
    expect(row.thb).toBe(0)
  })
})

describe('series', () => {
  it('gives the total on each day a balance changed', () => {
    expect(series(categories, accounts, balances, 32.5)).toEqual([
      { date: '2026-10-01', total: 165000 },
      { date: '2026-11-01', total: 135000 },
    ])
  })
})

describe('closed accounts', () => {
  const closed = accounts.map((a) => (a.id === 'a3' ? { ...a, closed_on: '2026-11-10' } : a))

  it('leave the current total but stay in earlier dates', () => {
    expect(summarize(categories, closed, balances, 32.5).total).toBe(120000 + 65000)
    expect(summarize(categories, closed, balances, 32.5, '2026-11-01').total).toBe(120000 + 65000 - 50000)
  })
})

describe('history', () => {
  const TODAY = '2026-12-05'
  const frozen: Snapshot[] = [{ id: 's1', date: '2026-10-20', usd_rate: 30 }]

  it('shows frozen dates, month ends without a frozen date, and today', () => {
    expect(historyDates(balances, frozen, TODAY)).toEqual([
      { date: '2026-10-20', kind: 'frozen' }, // October has a frozen date, so no automatic end-of-October column
      { date: '2026-11-30', kind: 'month-end' },
      { date: '2026-12-05', kind: 'today' },
    ])
    expect(historyDates([], [], TODAY)).toEqual([])
  })

  it('builds totals, change between columns, and keeps the frozen exchange rate', () => {
    const h = buildHistory(categories, accounts, balances, frozen, 32.5, TODAY)
    expect(h.columns.map((c) => [c.assets, c.liabilities, c.netWorth, c.change])).toEqual([
      [100000 + 2000 * 30, 0, 160000, null],
      [120000 + 65000, 50000, 135000, -25000],
      [120000 + 65000, 50000, 135000, 0],
    ])
    expect(h.rows.map((r) => r.account.id)).toEqual(['a1', 'a2', 'a3']) // a4 never had a balance
    expect(h.rows[2].values).toEqual([null, 50000, 50000]) // the debt did not exist yet in October
  })
})
