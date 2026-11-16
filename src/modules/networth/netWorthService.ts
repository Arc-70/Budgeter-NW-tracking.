import { fetchAll } from '../../lib/fetchAll'
import { supabase } from '../../lib/supabase'
import { getProfile } from '../settings/settingsService'
import type { Currency, NwAccount, NwBalance, NwCategory } from './netWorthMath'

export interface NetWorthData {
  categories: NwCategory[]
  accounts: NwAccount[]
  balances: NwBalance[]
  usdRate: number
}

function check(error: { message: string; code?: string } | null, duplicate = 'That name is already used') {
  if (error) throw new Error(error.code === '23505' ? duplicate : error.message)
}

export async function loadNetWorth(): Promise<NetWorthData> {
  const [profile, categories, accounts, balances] = await Promise.all([
    getProfile(),
    supabase.from('nw_categories').select('id, name, kind').order('created_at'),
    supabase.from('nw_accounts').select('id, name, category_id, currency').order('created_at'),
    fetchAll<NwBalance>((from, to) =>
      supabase.from('nw_balances').select('account_id, date, balance').order('date').range(from, to),
    ),
  ])
  check(categories.error)
  check(accounts.error)
  return {
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
