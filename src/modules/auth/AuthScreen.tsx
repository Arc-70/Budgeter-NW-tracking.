import { useEffect, useState, type FormEvent } from 'react'
import { signIn, signUp } from './authService'

// The last username used on this device, so logging back in only needs the PIN.
const LAST_USER = 'budgeter-last-username'

export function AuthScreen() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [username, setUsername] = useState(() => localStorage.getItem(LAST_USER) ?? '')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      if (mode === 'up') await signUp(username, pin)
      else await signIn(username, pin)
      localStorage.setItem(LAST_USER, username.trim().toLowerCase())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  // Logging in: the moment the 6th digit is typed, go. No button press needed.
  useEffect(() => {
    if (mode === 'in' && pin.length === 6 && username.trim()) submit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <main className="auth">
      <form className="card" onSubmit={submit}>
        <h1>Budgeter</h1>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" />
        </label>
        <label>
          6-digit PIN
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            type="password"
            inputMode="numeric"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            autoFocus={username !== ''}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {mode === 'up' ? 'Create account' : 'Log in'}
        </button>
        <button type="button" className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Log in'}
        </button>
      </form>
    </main>
  )
}
