import { fetchAll } from '../../lib/fetchAll'
import { supabase } from '../../lib/supabase'
import { getProfile } from '../settings/settingsService'
import { listCategories } from '../transactions/transactionService'
import type { Category } from '../transactions/types'
import { computePot, type BalanceReset, type BudgetTx, type PayRule, type PotSummary } from './potMath'

export interface BudgetData {
  rules: PayRule[]
  resets: BalanceReset[]
  txs: BudgetTx[]
  categories: Category[]
  fallbackWeekStartDay: number
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

export async function listPayRules(): Promise<PayRule[]> {
  const { data, error } = await supabase.from('pay_rules').select('id, amount, interval, every, start_date, end_date').order('start_date')
  check(error)
  return data!.map((r) => ({ ...r, amount: Number(r.amount) })) as PayRule[]
}

export async function listResets(): Promise<BalanceReset[]> {
  const { data, error } = await supabase.from('balance_resets').select('id, date, amount, created_at').order('date')
  check(error)
  return data!.map((r) => ({ ...r, amount: Number(r.amount) }))
}

// Everything the pot maths needs, loaded in one go.
export async function loadBudgetData(): Promise<BudgetData> {
  const [rules, resets, profile, categories, rows] = await Promise.all([
    listPayRules(),
    listResets(),
    getProfile(),
    listCategories(),
    fetchAll<BudgetTx>((from, to) =>
      supabase.from('transactions').select('date, amount, type, category_id, created_at').order('date').range(from, to),
    ),
  ])
  return {
    rules,
    resets,
    categories,
    fallbackWeekStartDay: profile.week_start_day,
    txs: rows.map((t) => ({ ...t, amount: Number(t.amount) })),
  }
}

export const potFor = (d: BudgetData, today: string): PotSummary =>
  computePot(d.rules, d.resets, d.txs, d.fallbackWeekStartDay, today)

export async function addPayRule(amount: number, interval: PayRule['interval'], every: number, startDate: string): Promise<void> {
  if (!(amount > 0)) throw new Error('Pay amount must be more than 0')
  if (!Number.isInteger(every) || every < 1) throw new Error('"Every" must be a whole number, 1 or more')
  if (!startDate) throw new Error('Pick a start date')
  const { error } = await supabase.from('pay_rules').insert({ amount, interval, every, start_date: startDate })
  check(error)
}

// Ending a rule keeps its past pay in the pot; it just stops paying after `endDate`.
export async function endPayRule(id: string, endDate: string): Promise<void> {
  const { error } = await supabase.from('pay_rules').update({ end_date: endDate }).eq('id', id)
  check(error)
}

// Deleting removes the rule and all the pay it ever added. For mistakes only.
export async function deletePayRule(id: string): Promise<void> {
  const { error } = await supabase.from('pay_rules').delete().eq('id', id)
  check(error)
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Not logged in')
  return data.session.user.id
}

// "I have this much right now." One per day; setting it again replaces it.
export async function setPotBalance(amount: number, date: string): Promise<void> {
  if (!Number.isFinite(amount)) throw new Error('Type the amount you have')
  const { error } = await supabase
    .from('balance_resets')
    .upsert({ user_id: await userId(), date, amount, created_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
  check(error)
}

export async function deleteReset(id: string): Promise<void> {
  const { error } = await supabase.from('balance_resets').delete().eq('id', id)
  check(error)
}
