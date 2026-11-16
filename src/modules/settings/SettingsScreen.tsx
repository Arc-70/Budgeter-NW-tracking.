import { useCallback, useEffect, useState } from 'react'
import { errorText } from '../../lib/format'
import { applyTheme, getTheme, type Theme } from '../../lib/theme'
import { signOut } from '../auth/authService'
import { PayPlanCard } from '../budget/PayPlanCard'
import type { Rule } from '../rules/matchCategory'
import { addRule, deleteRule, listRules } from '../rules/rulesService'
import { listCategories } from '../transactions/transactionService'
import type { Category } from '../transactions/types'
import {
  addCategory, deleteCategory, getProfile, setCategoryLimit, updateProfile, type Profile,
} from './settingsService'

export function SettingsScreen() {
  const [theme, setTheme] = useState<Theme>(getTheme())
  const [profile, setProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const [rate, setRate] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [rules, setRules] = useState<Rule[]>([])
  const [keyword, setKeyword] = useState('')
  const [keywordCategory, setKeywordCategory] = useState('')

  const reload = useCallback(async () => {
    try {
      const [p, cats, rs] = await Promise.all([getProfile(), listCategories(), listRules()])
      setRules(rs)
      setProfile(p)
      setRate(String(p.usd_rate))
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

      <PayPlanCard />

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
        <h3>Auto-categorise by keyword</h3>
        <p className="muted small">
          When a note you type, or the text on a scanned slip, contains a keyword, the category is picked for you. You can
          still change it before saving.
        </p>
        {rules.map((r) => (
          <div className="row" key={r.id}>
            <span>
              “{r.keyword}” → {categories.find((c) => c.id === r.category_id)?.name ?? '?'}
            </span>
            <button className="link" aria-label={`Delete keyword ${r.keyword}`} onClick={() => run(() => deleteRule(r.id), 'Keyword removed')}>
              ✕
            </button>
          </div>
        ))}
        <div className="row wrap">
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword, e.g. 7-eleven" />
          <select value={keywordCategory} onChange={(e) => setKeywordCategory(e.target.value)} aria-label="Category for keyword">
            <option value="">Category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="ghost inline"
            onClick={() =>
              run(async () => {
                await addRule(keyword, keywordCategory)
                setKeyword('')
              }, 'Keyword added')
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
