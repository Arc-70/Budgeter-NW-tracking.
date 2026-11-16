import { describe, expect, it } from 'vitest'
import { series, summarize, type NwAccount, type NwBalance, type NwCategory } from './netWorthMath'

const categories: NwCategory[] = [
  { id: 'bank', name: 'Bank and cash', kind: 'asset' },
  { id: 'inv', name: 'Investments', kind: 'asset' },
  { id: 'debt', name: 'Debts', kind: 'liability' },
]
const accounts: NwAccount[] = [
  { id: 'a1', name: 'Savings', category_id: 'bank', currency: 'THB' },
  { id: 'a2', name: 'US brokerage', category_id: 'inv', currency: 'USD' },
  { id: 'a3', name: 'Credit card', category_id: 'debt', currency: 'THB' },
  { id: 'a4', name: 'Empty', category_id: 'bank', currency: 'THB' },
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
