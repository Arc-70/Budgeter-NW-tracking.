import { useState } from 'react'
import { isConfigured } from './config'
import { AuthScreen } from './modules/auth/AuthScreen'
import { useSession } from './modules/auth/useSession'
import { BudgetScreen } from './modules/budget/BudgetScreen'
import { NetWorthScreen } from './modules/networth/NetWorthScreen'
import { SettingsScreen } from './modules/settings/SettingsScreen'
import { ScanScreen } from './modules/slips/ScanScreen'
import { TransactionsScreen } from './modules/transactions/TransactionsScreen'

type Page = 'week' | 'add' | 'scan' | 'networth' | 'settings'

const PAGES: { id: Page; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'add', label: 'Add' },
  { id: 'scan', label: 'Scan' },
  { id: 'networth', label: 'Net worth' },
  { id: 'settings', label: 'Settings' },
]

export function App() {
  const session = useSession()
  const [page, setPage] = useState<Page>('week')

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
    <div className="shell">
      {/* Sidebar on a PC, bottom tab bar on a phone (see styles.css). */}
      <nav className="nav">
        <strong>Budgeter</strong>
        {PAGES.map((p) => (
          <button key={p.id} className={page === p.id ? 'on' : ''} onClick={() => setPage(p.id)}>
            {p.label}
          </button>
        ))}
      </nav>
      <main className="page">
        {page === 'week' && <BudgetScreen onAdd={() => setPage('add')} />}
        {page === 'add' && <TransactionsScreen />}
        {page === 'scan' && <ScanScreen />}
        {page === 'networth' && <NetWorthScreen />}
        {page === 'settings' && <SettingsScreen />}
      </main>
    </div>
  )
}
