// Pure net worth maths. No database or screen code in here.

export type Currency = 'THB' | 'USD'

export interface NwCategory {
  id: string
  name: string
  kind: 'asset' | 'liability'
}

export interface NwAccount {
  id: string
  name: string
  category_id: string
  currency: Currency
}

export interface NwBalance {
  account_id: string
  date: string // YYYY-MM-DD
  balance: number // in the account's own currency; debts are typed as positive amounts owed
}

export interface AccountRow {
  account: NwAccount
  category: NwCategory
  balance: number | null // null = never updated
  thb: number // signed: debts count as negative
  lastUpdated: string | null
}

export interface Summary {
  total: number
  byCategory: { category: NwCategory; total: number }[]
  accounts: AccountRow[]
}

export function toThb(balance: number, currency: Currency, usdRate: number): number {
  return currency === 'USD' ? balance * usdRate : balance
}

// The newest balance for each account, optionally only looking at dates up to `onOrBefore`.
export function latestBalances(balances: NwBalance[], onOrBefore?: string): Map<string, NwBalance> {
  const latest = new Map<string, NwBalance>()
  for (const b of balances) {
    if (onOrBefore && b.date > onOrBefore) continue
    const current = latest.get(b.account_id)
    if (!current || b.date > current.date) latest.set(b.account_id, b)
  }
  return latest
}

export function summarize(
  categories: NwCategory[],
  accounts: NwAccount[],
  balances: NwBalance[],
  usdRate: number,
  onOrBefore?: string,
): Summary {
  const latest = latestBalances(balances, onOrBefore)
  const totals = new Map<string, number>(categories.map((c) => [c.id, 0]))
  const rows: AccountRow[] = []

  for (const account of accounts) {
    const category = categories.find((c) => c.id === account.category_id)
    if (!category) continue
    const entry = latest.get(account.id)
    const sign = category.kind === 'liability' ? -1 : 1
    const thb = entry ? sign * toThb(entry.balance, account.currency, usdRate) : 0
    totals.set(category.id, (totals.get(category.id) ?? 0) + thb)
    rows.push({ account, category, balance: entry ? entry.balance : null, thb, lastUpdated: entry ? entry.date : null })
  }

  const byCategory = categories
    .map((category) => ({ category, total: totals.get(category.id) ?? 0 }))
    .sort((a, b) => b.total - a.total)

  return { total: byCategory.reduce((sum, c) => sum + c.total, 0), byCategory, accounts: rows }
}

// Net worth on every day a balance was updated, oldest first.
export function series(
  categories: NwCategory[],
  accounts: NwAccount[],
  balances: NwBalance[],
  usdRate: number,
): { date: string; total: number }[] {
  const dates = [...new Set(balances.map((b) => b.date))].sort()
  return dates.map((date) => ({ date, total: summarize(categories, accounts, balances, usdRate, date).total }))
}
