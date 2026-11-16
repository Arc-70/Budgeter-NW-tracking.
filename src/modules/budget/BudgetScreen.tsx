import { useCallback, useEffect, useState } from 'react'
import { dateWithYear, errorText, money, shortDate, todayISO } from '../../lib/format'
import { listTransactions } from '../transactions/transactionService'
import type { Transaction } from '../transactions/types'
import { loadBudgetData, potFor, type BudgetData } from './budgetService'
import { Meter } from './Meter'
import { describeRule, PayPlanCard } from './PayPlanCard'

const inDays = (n: number) => (n === 1 ? 'tomorrow' : `in ${n} days`)

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

  const pot = potFor(data, todayISO())

  // First visit: set up how you get paid.
  if (!pot.hasPlan) {
    return (
      <div className="stack narrow">
        <h2>Set up your budget</h2>
        <p className="muted">Add how you get paid, and the money you have right now. You can change both any time in Settings.</p>
        <PayPlanCard onChange={reload} />
      </div>
    )
  }

  const thisWeek = recent.filter((t) => t.date >= pot.weekStart && t.date <= pot.weekEnd)
  const categoryName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? 'Uncategorised'
  const maxSpent = Math.max(1, ...pot.history.map((h) => h.spent))
  const uncategorised = pot.spentByCategory.get(null) ?? 0
  const next = pot.nextPays[0]

  return (
    <div className="stack">
      <div className="head">
        <h2>Week of {shortDate(pot.weekStart)}</h2>
        <button className="primary inline" onClick={onAdd}>
          + Add transaction
        </button>
      </div>

      <div className="two">
        <div className="card">
          <h3>Cash left</h3>
          <div className={`hero num ${pot.pot < 0 ? 'neg' : ''}`}>{money(pot.pot)}</div>
          {pot.since && (
            <p className="muted small">
              Counted from {money(pot.since.amount)} on {dateWithYear(pot.since.date)}
            </p>
          )}
          <div className="pot">
            <div>
              <span className="muted small">Spent this week</span>
              <b className="num">{money(pot.spentThisWeek)}</b>
            </div>
            <div>
              <span className="muted small">Paid this week</span>
              <b className="num">{money(pot.paidThisWeek)}</b>
            </div>
            <div>
              <span className="muted small">Next pay</span>
              <b className="num">{next ? money(next.rule.amount) : '—'}</b>
            </div>
          </div>
          {pot.nextPays.length === 0 && <p className="muted small">No upcoming pay. Add a pay line in Settings.</p>}
          {pot.nextPays.map((n) => (
            <p className="small" key={n.rule.id}>
              <b className="num">{money(n.rule.amount)}</b>{' '}
              <span className="muted">
                {inDays(n.inDays)} · {shortDate(n.date)} · {describeRule(n.rule)}
              </span>
            </p>
          ))}
        </div>

        <div className="card">
          <h3>Spent per week</h3>
          <div className="weeks">
            {pot.history.map((h) => (
              <div key={h.weekStart} title={`${shortDate(h.weekStart)}: ${money(h.spent)}`}>
                <span className="num">{h.spent >= 1000 ? `${(h.spent / 1000).toFixed(1)}k` : Math.round(h.spent)}</span>
                <i style={{ height: `${(h.spent / maxSpent) * 75}%` }} />
                {h.weekStart === pot.weekStart ? 'This wk' : shortDate(h.weekStart)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="two">
        <div className="card">
          <h3>Categories (soft limits)</h3>
          {data.categories.map((c) => (
            <Meter
              key={c.id}
              name={c.name}
              spent={(c.limit_period === 'monthly' ? pot.spentByCategoryMonth : pot.spentByCategory).get(c.id) ?? 0}
              limit={c.weekly_limit}
              period={c.limit_period}
            />
          ))}
          {uncategorised > 0 && <Meter name="Uncategorised" spent={uncategorised} limit={null} />}
          <p className="muted small">Weekly unless marked "this month". Set limits in Settings; going over only shows a warning.</p>
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
