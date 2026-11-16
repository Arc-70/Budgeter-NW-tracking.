import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { errorText, money, shortDate, todayISO } from '../../lib/format'
import { loadBudgetData } from '../budget/budgetService'
import { computeWeek } from '../budget/weekMath'
import { addTransaction, deleteTransaction, listCategories, listTransactions } from './transactionService'
import type { Category, Transaction, TransactionType } from './types'

export function TransactionsScreen() {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [weekSpent, setWeekSpent] = useState<Map<string | null, number>>(new Map())

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')

  const reload = useCallback(async () => {
    try {
      const [cats, txs, budget] = await Promise.all([listCategories(), listTransactions(), loadBudgetData()])
      setCategories(cats)
      setTransactions(txs)
      const week = computeWeek(budget.payChanges, budget.txs, budget.weekStartDay, todayISO())
      setWeekSpent(week ? week.spentByCategory : new Map())
      setError(null)
    } catch (err) {
      setError(errorText(err, 'Could not load data'))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await addTransaction({
        type,
        amount: Number(amount),
        category_id: type === 'expense' && categoryId ? categoryId : null,
        date,
        note: note.trim() || null,
      })
      setAmount('')
      setNote('')
      await reload()
    } catch (err) {
      setError(errorText(err, 'Could not save'))
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this transaction?')) return
    try {
      await deleteTransaction(id)
      await reload()
    } catch (err) {
      setError(errorText(err, 'Could not delete'))
    }
  }

  // Soft limit: warn if this expense would push the category over, but never block it.
  const picked = categories.find((c) => c.id === categoryId)
  const projected = (weekSpent.get(categoryId) ?? 0) + (Number(amount) || 0)
  const overBy = type === 'expense' && picked?.weekly_limit && Number(amount) > 0 ? projected - picked.weekly_limit : 0

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? '—'

  return (
    <div className="two form-left">
      <form className="card" onSubmit={submit}>
        <h2>Add transaction</h2>
        <div className="toggle">
          <button type="button" className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>
            Expense
          </button>
          <button type="button" className={type === 'income' ? 'on' : ''} onClick={() => setType('income')}>
            Income
          </button>
        </div>
        <label>
          Amount (THB)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" required />
        </label>
        {type === 'expense' && (
          <label>
            Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorised</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Date
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" required />
        </label>
        <label>
          Note
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </label>
        {overBy > 0 && picked && (
          <p className="note">
            {picked.name} will be {money(overBy)} over its {money(picked.weekly_limit!)} limit this week. You can still save.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary">Save</button>
      </form>

      <section className="card">
        <h2>Recent</h2>
        {transactions.length === 0 && <p className="muted">Nothing logged yet.</p>}
        <ul className="tx-list">
          {transactions.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.type === 'income' ? 'Income' : categoryName(t.category_id)}</strong>
                <span className="muted">
                  {shortDate(t.date)}
                  {t.note ? ` · ${t.note}` : ''}
                </span>
              </div>
              <span className={`num ${t.type === 'income' ? 'pos' : ''}`}>
                {t.type === 'income' ? '+' : '-'}
                {money(t.amount)}
              </span>
              <button className="link" onClick={() => remove(t.id)} aria-label="Delete">
                ✕
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
