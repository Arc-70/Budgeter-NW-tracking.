import { fetchAll } from '../../lib/fetchAll'
import { supabase } from '../../lib/supabase'
import { getProfile } from '../settings/settingsService'
import { latestBalances, type Currency, type NwAccount, type NwBalance, type NwCategory, type Snapshot } from './netWorthMath'

export interface NetWorthData {
  categories: NwCategory[]
  accounts: NwAccount[]
  balances: NwBalance[]
  snapshots: Snapshot[]
  usdRate: number
}

function check(error: { message: string; code?: string } | null, duplicate = 'That name is already used') {
  if (error) throw new Error(error.code === '23505' ? duplicate : error.message)
}

export async function loadNetWorth(): Promise<NetWorthData> {
  const [profile, categories, accounts, snapshots, balances] = await Promise.all([
    getProfile(),
    supabase.from('nw_categories').select('id, name, kind').order('created_at'),
    supabase.from('nw_accounts').select('id, name, category_id, currency, closed_on').order('created_at'),
    supabase.from('nw_snapshots').select('id, date, usd_rate').order('date'),
    fetchAll<NwBalance>((from, to) =>
      supabase.from('nw_balances').select('account_id, date, balance').order('date').range(from, to),
    ),
  ])
  check(categories.error)
  check(accounts.error)
  check(snapshots.error)
  return {
    snapshots: snapshots.data!.map((x) => ({ ...x, usd_rate: Number(x.usd_rate) })),
    usdRate: profile.usd_rate,
    categories: categories.data as NwCategory[],
    accounts: accounts.data as NwAccount[],
    balances: balances.map((b) => ({ ...b, balance: Number(b.balance) })),
  }
}

export async function addNwCategory(name: string, kind: 'asset' | 'liability'): Promise<void> {
  if (!name.trim()) throw new Error('Give the category a name')
  const { error } = await supabase.from('nw_categories').insert({ name: name.trim(), kind })
  check(error, 'That category already exists')
}

export async function deleteNwCategory(id: string): Promise<void> {
  const { error } = await supabase.from('nw_categories').delete().eq('id', id)
  check(error)
}

export async function addAccount(name: string, categoryId: string, currency: Currency): Promise<string> {
  if (!name.trim()) throw new Error('Give the account a name')
  if (!categoryId) throw new Error('Pick a category')
  const { data, error } = await supabase
    .from('nw_accounts')
    .insert({ name: name.trim(), category_id: categoryId, currency })
    .select('id')
    .single()
  check(error, 'That account already exists')
  return data!.id
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('nw_accounts').delete().eq('id', id)
  check(error)
}

// One balance per account per day; saving again on the same day replaces it.
export async function setBalance(accountId: string, date: string, balance: number): Promise<void> {
  if (!Number.isFinite(balance) || balance < 0) throw new Error('Balance must be 0 or more')
  const { error } = await supabase
    .from('nw_balances')
    .upsert({ account_id: accountId, date, balance }, { onConflict: 'account_id,date' })
  check(error)
}

// Closing keeps the account in history before `date`; deleting removes it everywhere.
export async function closeAccount(id: string, date: string | null): Promise<void> {
  const { error } = await supabase.from('nw_accounts').update({ closed_on: date }).eq('id', id)
  check(error)
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Not logged in')
  return data.session.user.id
}

// Freezes a date. `typed` holds balances entered for that date. With
// `carryForward`, every other open account gets its latest known balance
// written on that date too, so the frozen column never changes afterwards.
export async function freezeSnapshot(
  data: NetWorthData,
  date: string,
  usdRate: number,
  typed: Map<string, number>,
  carryForward: boolean,
): Promise<void> {
  if (!date) throw new Error('Pick a date')
  if (!(usdRate > 0)) throw new Error('The USD rate must be more than 0')
  const latest = latestBalances(data.balances, date)
  const rows: { account_id: string; date: string; balance: number }[] = []
  for (const account of data.accounts) {
    if (account.closed_on && account.closed_on <= date) continue
    const balance = typed.get(account.id) ?? (carryForward ? latest.get(account.id)?.balance : undefined)
    if (balance !== undefined) rows.push({ account_id: account.id, date, balance })
  }
  if (rows.some((r) => !Number.isFinite(r.balance) || r.balance < 0)) throw new Error('Balances must be 0 or more')
  if (rows.length > 0) {
    const { error } = await supabase.from('nw_balances').upsert(rows, { onConflict: 'account_id,date' })
    check(error)
  }
  const { error } = await supabase
    .from('nw_snapshots')
    .upsert({ user_id: await userId(), date, usd_rate: usdRate }, { onConflict: 'user_id,date' })
  check(error)
}

// Unfreezes a date. The balances entered for it are kept.
export async function deleteSnapshot(id: string): Promise<void> {
  const { error } = await supabase.from('nw_snapshots').delete().eq('id', id)
  check(error)
}
