import { supabase } from '../../lib/supabase'
import type { Category, NewTransaction, Transaction } from './types'

// All database access for transactions lives here, so the screens never
// talk to Supabase directly.

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('id, name, weekly_limit').order('name')
  if (error) throw new Error(error.message)
  return data
}

export async function listTransactions(limit = 100): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, amount, type, category_id, note, source')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data.map((t) => ({ ...t, amount: Number(t.amount) }))
}

export async function addTransaction(tx: NewTransaction): Promise<void> {
  if (!(tx.amount > 0)) throw new Error('Amount must be more than 0')
  const { error } = await supabase.from('transactions').insert({ ...tx, source: 'manual' })
  if (error) throw new Error(error.message)
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
