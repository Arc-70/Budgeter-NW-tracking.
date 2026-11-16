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
  closed_on: string | null // closed accounts stay in history before this date
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
    // A closed account drops out from its closing date onwards.
    if (account.closed_on && (!onOrBefore || account.closed_on <= onOrBefore)) continue
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

// ---------- History: the comparison table ----------

// A frozen snapshot: a date the user chose to keep, with the USD rate of that day.
export interface Snapshot {
  id: string
  date: string
  usd_rate: number
}

export interface HistoryColumn {
  date: string
  kind: 'frozen' | 'month-end' | 'today'
  snapshot: Snapshot | null
  assets: number
  liabilities: number // positive number owed
  netWorth: number
  change: number | null // against the column before it
}

export interface History {
  columns: HistoryColumn[] // oldest first
  rows: { account: NwAccount; category: NwCategory; values: (number | null)[] }[] // THB, one value per column
}

const monthEnd = (year: number, monthIndex: number) => new Date(Date.UTC(year, monthIndex + 1, 0)).toISOString().slice(0, 10)

// Which dates get a column: every frozen snapshot, the end of each past month
// that has no frozen snapshot of its own, and today.
export function historyDates(balances: NwBalance[], snapshots: Snapshot[], today: string): { date: string; kind: HistoryColumn['kind'] }[] {
  const frozen = snapshots.filter((s) => s.date <= today)
  const earliest = [...balances.map((b) => b.date), ...frozen.map((s) => s.date)].sort()[0]
  if (!earliest) return []

  const dates = frozen.map((s) => ({ date: s.date, kind: 'frozen' as HistoryColumn['kind'] }))
  const frozenMonths = new Set(frozen.map((s) => s.date.slice(0, 7)))
  const [startYear, startMonth] = earliest.split('-').map(Number)
  for (let i = 0; ; i++) {
    const end = monthEnd(startYear, startMonth - 1 + i)
    if (end >= today) break
    if (!frozenMonths.has(end.slice(0, 7))) dates.push({ date: end, kind: 'month-end' })
  }
  if (!frozen.some((s) => s.date === today)) dates.push({ date: today, kind: 'today' })
  return dates.sort((a, b) => a.date.localeCompare(b.date))
}

export function buildHistory(
  categories: NwCategory[],
  accounts: NwAccount[],
  balances: NwBalance[],
  snapshots: Snapshot[],
  usdRate: number,
  today: string,
): History {
  const dates = historyDates(balances, snapshots, today)
  const values = new Map<string, (number | null)[]>(accounts.map((a) => [a.id, []]))
  const columns: HistoryColumn[] = []

  for (const { date, kind } of dates) {
    const snapshot = snapshots.find((s) => s.date === date) ?? null
    const rate = snapshot ? snapshot.usd_rate : usdRate // frozen columns keep the rate of their day
    const latest = latestBalances(balances, date)
    let assets = 0
    let liabilities = 0
    for (const account of accounts) {
      const category = categories.find((c) => c.id === account.category_id)
      const entry = latest.get(account.id)
      const open = !account.closed_on || account.closed_on > date
      const thb = category && entry && open ? toThb(entry.balance, account.currency, rate) : null
      values.get(account.id)!.push(thb)
      if (thb !== null && category) {
        if (category.kind === 'liability') liabilities += thb
        else assets += thb
      }
    }
    const netWorth = assets - liabilities
    const previous = columns[columns.length - 1]
    columns.push({ date, kind, snapshot, assets, liabilities, netWorth, change: previous ? netWorth - previous.netWorth : null })
  }

  // Assets first, then liabilities; accounts that never had a value are left out.
  const rows = accounts
    .map((account) => ({ account, category: categories.find((c) => c.id === account.category_id)!, values: values.get(account.id)! }))
    .filter((r) => r.category && r.values.some((v) => v !== null))
    .sort((a, b) => Number(a.category.kind === 'liability') - Number(b.category.kind === 'liability'))

  return { columns, rows }
}
