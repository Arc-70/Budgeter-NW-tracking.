import { isConfigured } from './config'
import { AuthScreen } from './modules/auth/AuthScreen'
import { signOut } from './modules/auth/authService'
import { useSession } from './modules/auth/useSession'
import { TransactionsScreen } from './modules/transactions/TransactionsScreen'

export function App() {
  const session = useSession()

  if (!isConfigured) {
    return (
      <main className="auth">
        <div className="card">
          <h1>Budgeter</h1>
          <p>The Supabase Project URL has not been set yet. Add it in src/config.ts.</p>
        </div>
      </main>
    )
  }
  if (session === undefined) return <main className="auth">Loading…</main>
  if (session === null) return <AuthScreen />

  return (
    <>
      <header className="topbar">
        <strong>Budgeter</strong>
        <span>
          {session.user.user_metadata.username}
          <button className="link" onClick={signOut}>
            Log out
          </button>
        </span>
      </header>
      <main className="page">
        <TransactionsScreen />
      </main>
    </>
  )
}
