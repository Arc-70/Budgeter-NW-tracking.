import { supabase } from '../../lib/supabase'
import type { Rule } from './matchCategory'

export async function listRules(): Promise<Rule[]> {
  const { data, error } = await supabase.from('category_rules').select('id, keyword, category_id').order('keyword')
  if (error) throw new Error(error.message)
  return data
}

export async function addRule(keyword: string, categoryId: string): Promise<void> {
  if (!keyword.trim()) throw new Error('Type a keyword')
  if (!categoryId) throw new Error('Pick a category for the keyword')
  const { error } = await supabase.from('category_rules').insert({ keyword: keyword.trim().toLowerCase(), category_id: categoryId })
  if (error) throw new Error(error.code === '23505' ? 'That keyword already has a category' : error.message)
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from('category_rules').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
