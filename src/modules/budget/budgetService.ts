import { fetchAll } from '../../lib/fetchAll'
import { supabase } from '../../lib/supabase'
import { getProfile } from '../settings/settingsService'
import { listCategories } from '../transactions/transactionService'
import type { Category } from '../transactions/types'
import type { BudgetTx, PayChange } from './weekMath'

export interface BudgetData {
  payChanges: PayChange[]
  txs: BudgetTx[]
  weekStartDay: number
  categories: Category[]
}

export async function listPayChanges(): Promise<PayChange[]> {
  const { data, error } = await supabase.from('pay_changes').select('effective_from, amount').order('effective_from')
  if (error) throw new Error(error.message)
  return data.map((p) => ({ ...p, amount: Number(p.amount) }))
}

// Everything the budget maths needs, loaded in one go.
export async function loadBudgetData(): Promise<BudgetData> {
  const [payChanges, profile, categories, rows] = await Promise.all([
    listPayChanges(),
    getProfile(),
    listCategories(),
    fetchAll<BudgetTx>((from, to) =>
      supabase.from('transactions').select('date, amount, type, category_id').order('date').range(from, to),
    ),
  ])
  return {
    payChanges,
    weekStartDay: profile.week_start_day,
    categories,
    txs: rows.map((t) => ({ ...t, amount: Number(t.amount) })),
  }
}
