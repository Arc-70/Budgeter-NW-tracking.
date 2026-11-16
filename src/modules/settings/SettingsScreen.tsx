import { useCallback, useEffect, useState } from 'react'
import { errorText, money, todayISO } from '../../lib/format'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { signOut } from '../auth/authService'
import { listPayChanges } from '../budget/budgetService'
import { addDays, payForWeek, weekStartOf } from '../budget/weekMath'
import { listCategories } from '../transactions/transactionService'
import type { Category } from '../transactions/types'
import {
  addCategory, deleteCategory, getProfile, setCategoryLimit, setWeeklyPay, updateProfile, type Profile,
} from './settingsService'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function SettingsScreen() {
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentPay, setCurrentPay] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const [pay, setPay] = useState('')
  const [payFrom, setPayFrom] = useState<'this' | 'next'>('this')
  const [rate, setRate] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const reload = useCallback(async () => {
    try {
      const [p, pays, cats] = await Promise.all([getProfile(), listPayChanges(), listCategories()])
      setProfile(p)
      setRate(String(p.usd_rate))
      setCurrentPay(payForWeek(pays, weekStartOf(todayISO(), p.week_start_day)))
      setCategories(cats)
    } catch (err) {
      setMessage(errorText(err, 'Could not load settings'))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Runs a save, then refreshes and reports the result in one place.
  async function run(action: () => Promise<void>, done: string) {
    try {
      await action()
      await reload()
      setMessage(done)
    } catch (err) {
      setMessage(errorText(err, 'Could not save'))
    }
  }

  if (!profile) return <p className="muted">{message ?? 'Loading…'}</p>

  const thisWeek = weekStartOf(todayISO(), profile.week_start_day)

  return (
    <div className="stack narrow">
      <h2>Settings</h2>
      {message && <p className="note">{message}</p>}

      <div className="card">
        <h3>Theme</h3>
        <div className="seg">
          {(['pastel-dark', 'pastel-light'] as Theme[]).map((t) => (
            <button
              key={t}
              className={theme === t ? 'on' : ''}
              onClick={() => {
                applyTheme(t)
                setTheme(t)
              }}
            >
              {t === 'pastel-dark' ? 'Pastel blue on black' : 'Black on pastel blue'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Weekly pay</h3>
        <p className="muted small">Currently {money(currentPay)} a week. Earlier weeks keep the pay they had.</p>
        <label>
          New weekly pay (THB)
          <input value={pay} onChange={(e) => setPay(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" />
        </label>
        <label>
          Starts
          <select value={payFrom} onChange={(e) => setPayFrom(e.target.value as 'this' | 'next')}>
            <option value="this">This week</option>
            <option value="next">Next week</option>
          </select>
        </label>
        <button
          className="primary"
          onClick={() =>
            run(async () => {
              await setWeeklyPay(Number(pay), payFrom === 'this' ? thisWeek : addDays(thisWeek, 7))
              setPay('')
            }, 'Weekly pay saved')
          }
        >
          Save pay
        </button>
        <label>
          Day you get paid
          <select
            value={profile.week_start_day}
            onChange={(e) => run(() => updateProfile({ week_start_day: Number(e.target.value) }), 'Payday saved')}
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card">
        <h3>Spending categories</h3>
        <p className="muted small">Weekly limits are suggestions. Leave a limit empty for none.</p>
        {categories.map((c) => (
          <div className="row" key={c.id}>
            <span>{c.name}</span>
            <input
              className="short"
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="No limit"
              defaultValue={c.weekly_limit ?? ''}
              aria-label={`Weekly limit for ${c.name}`}
              onBlur={(e) => {
                const value = e.target.value === '' ? null : Number(e.target.value)
                if (value !== c.weekly_limit) run(() => setCategoryLimit(c.id, value), `${c.name} limit saved`)
              }}
            />
            <button
              className="link"
              aria-label={`Delete ${c.name}`}
              onClick={() => {
                if (confirm(`Delete "${c.name}"? Its transactions become uncategorised.`)) {
                  run(() => deleteCategory(c.id), `${c.name} deleted`)
                }
              }}
            >
              ✕
            </button>
          </div>
        ))}
        <div className="row">
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category" />
          <button
            className="ghost inline"
            onClick={() =>
              run(async () => {
                await addCategory(newCategory)
                setNewCategory('')
              }, 'Category added')
            }
          >
            Add
          </button>
        </div>
      </div>

      <div className="card">
        <h3>US dollar rate</h3>
        <p className="muted small">Used to show USD accounts in baht. Update it whenever you like.</p>
        <div className="row">
          <span>฿ per $1</span>
          <input className="short" value={rate} onChange={(e) => setRate(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" />
          <button className="ghost inline" onClick={() => run(() => updateProfile({ usd_rate: Number(rate) }), 'Rate saved')}>
            Save
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Account</h3>
        <p>Logged in as {profile.username}</p>
        <button className="ghost" onClick={signOut}>
          Log out
        </button>
      </div>
    </div>
  )
}
