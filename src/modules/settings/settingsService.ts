import { supabase } from '../../lib/supabase'

export interface Profile {
  username: string
  week_start_day: number // 0 = Sunday ... 6 = Saturday; only used when there is no weekly pay
  usd_rate: number // THB per 1 USD, typed in by the user
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Not logged in')
  return data.session.user.id
}

export async function getProfile(): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('username, week_start_day, usd_rate').single()
  if (error) throw new Error(error.message)
  return { ...data, usd_rate: Number(data.usd_rate) }
}

export async function updateProfile(changes: Partial<Pick<Profile, 'week_start_day' | 'usd_rate'>>): Promise<void> {
  if (changes.usd_rate !== undefined && !(changes.usd_rate > 0)) throw new Error('Rate must be more than 0')
  const { error } = await supabase.from('profiles').update(changes).eq('id', await userId())
  if (error) throw new Error(error.message)
}

export async function addCategory(name: string): Promise<void> {
  if (!name.trim()) throw new Error('Give the category a name')
  const { error } = await supabase.from('categories').insert({ name: name.trim() })
  if (error) throw new Error(error.code === '23505' ? 'That category already exists' : error.message)
}

export async function setCategoryLimit(id: string, weeklyLimit: number | null): Promise<void> {
  const { error } = await supabase.from('categories').update({ weekly_limit: weeklyLimit }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
