import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { errorText, money, shortDate, todayISO } from '../../lib/format'
import { setWeeklyPay, updateProfile } from '../settings/settingsService'
import { listTransactions } from '../transactions/transactionService'
import type { Transaction } from '../transactions/types'
import { loadBudgetData, type BudgetData } from './budgetService'
import { Meter } from './Meter'
import { computeWeek, weekStartOf } from './weekMath'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function BudgetScreen({ onAdd }: { onAdd: () => void }) {
  const [data, setData] = useState<BudgetData | null>(null)
  const [recent, setRecent] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const [d, txs] = await Promise.all([loadBudgetData(), listTransactions(200)])
      setData(d)
      setRecent(txs)
      setError(null)
    } catch (err) {
      setError(errorText(err, 'Could not load the budget'))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="muted">Loading…</p>

  const week = computeWeek(data.payChanges, data.txs, data.weekStartDay, todayISO())
  if (!week) return <PaySetup onDone={reload} />

  const perDay = week.left > 0 ? week.left / week.daysLeft : 0
  const thisWeek = recent.filter((t) => t.date >= week.weekStart && t.date <= week.weekEnd)
  const categoryName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? 'Uncategorised'
  const maxSpent = Math.max(1, ...week.history.map((h) => h.spent))
  const uncategorised = week.spentByCategory.get(null) ?? 0

  return (
    <div className="stack">
      <div className="head">
        <h2>Week of {shortDate(week.weekStart)}</h2>
        <button className="primary inline" onClick={onAdd}>
          + Add transaction
        </button>
      </div>

      <div className="two">
        <div className="card">
          <h3>Left this week</h3>
          <div className={`hero num ${week.left < 0 ? 'neg' : ''}`}>{money(week.left)}</div>
          <p className="muted small">
            {week.daysLeft} {week.daysLeft === 1 ? 'day' : 'days'} left
            {perDay > 0 ? ` · about ${money(Math.floor(perDay))} a day` : ''}
          </p>
          <div className="pot">
            <div>
              <span className="muted small">Pay</span>
              <b className="num">{money(week.pay)}</b>
            </div>
            <div>
              <span className="muted small">Rolled over</span>
              <b className="num">
                {week.rolledOver > 0 ? '+' : ''}
                {money(week.rolledOver)}
              </b>
            </div>
            <div>
              <span className="muted small">Spent</span>
              <b className="num">{money(week.spent)}</b>
            </div>
          </div>
          {week.income > 0 && <p className="muted small">Includes {money(week.income)} of extra income this week.</p>}
        </div>

        <div className="card">
          <h3>Spent per week</h3>
          <div className="weeks">
            {week.history.map((h) => (
              <div key={h.weekStart} title={`${shortDate(h.weekStart)}: ${money(h.spent)}`}>
                <span className="num">{h.spent >= 1000 ? `${(h.spent / 1000).toFixed(1)}k` : Math.round(h.spent)}</span>
                <i style={{ height: `${(h.spent / maxSpent) * 75}%` }} />
                {h.weekStart === week.weekStart ? 'This wk' : shortDate(h.weekStart)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <h3>Categories (soft limits)</h3>
          {data.categories.map((c) => (
            <Meter key={c.id} name={c.name} spent={week.spentByCategory.get(c.id) ?? 0} limit={c.weekly_limit} />
          ))}
          {uncategorised > 0 && <Meter name="Uncategorised" spent={uncategorised} limit={null} />}
          <p className="muted small">Set limits in Settings. Going over only shows a warning.</p>
        </div>

        <div className="card">
          <h3>This week's transactions</h3>
          {thisWeek.length === 0 && <p className="muted small">Nothing logged this week yet.</p>}
          {thisWeek.map((t) => (
            <div className="tx" key={t.id}>
              <span>
                {t.type === 'income' ? 'Income' : categoryName(t.category_id)}
                <span className="muted small">
                  {shortDate(t.date)}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
              </span>
              <span className={`num ${t.type === 'income' ? 'pos' : ''}`}>
                {t.type === 'income' ? '+' : '-'}
                {money(t.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Shown once, before the first weekly pay is set.
function PaySetup({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState(new Date().getDay())
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await updateProfile({ week_start_day: day })
      await setWeeklyPay(Number(amount), weekStartOf(todayISO(), day))
      onDone()
    } catch (err) {
      setError(errorText(err, 'Could not save'))
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>Set up your weekly budget</h2>
      <p className="muted small">You can change both of these later in Settings.</p>
      <label>
        Weekly pay (THB)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" required />
      </label>
      <label>
        Day you get paid
        <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {DAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="error">{error}</p>}
      <button className="primary">Start tracking</button>
    </form>
  )
}
