// Pure helpers for username + PIN login. No network calls here, so these are
// easy to test on their own.

const EMAIL_DOMAIN = 'budgeter-nw.app'

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function validateUsername(username: string): string | null {
  if (!/^[a-z0-9_]{3,20}$/.test(normalizeUsername(username))) {
    return 'Username must be 3-20 characters: letters, numbers or _'
  }
  return null
}

export function validatePin(pin: string): string | null {
  return /^\d{6}$/.test(pin) ? null : 'PIN must be exactly 6 digits'
}

// Supabase logs people in by email, so each username maps to a made-up
// address that is never actually emailed.
export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`
}
