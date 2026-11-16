import { supabase } from '../../lib/supabase'
import { normalizeUsername, usernameToEmail, validatePin, validateUsername } from './credentials'

function check(username: string, pin: string) {
  const problem = validateUsername(username) ?? validatePin(pin)
  if (problem) throw new Error(problem)
}

export async function signUp(username: string, pin: string) {
  check(username, pin)
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password: pin,
    options: { data: { username: normalizeUsername(username) } },
  })
  if (error) {
    throw new Error(error.message.includes('already') ? 'That username is taken' : error.message)
  }
}

export async function signIn(username: string, pin: string) {
  check(username, pin)
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password: pin,
  })
  if (error) throw new Error('Wrong username or PIN')
}

export async function signOut() {
  await supabase.auth.signOut()
}
