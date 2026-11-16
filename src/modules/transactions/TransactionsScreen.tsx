import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { errorText, money, shortDate, todayISO } from '../../lib/format'
import { LimitWarning, useWeekSpending } from '../budget/limitWarning'
import { matchCategory, type Rule } from '../rules/matchCategory'
import { listRules } from '../rules/rulesService'
import { addTransaction, deleteTransaction, listCategories, listTransactions } from './transactionService'
import type { Category, Transaction, TransactionType } from './types'

export function TransactionsScreen() {
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState<Rule[]>([])
  const [saves, setSaves] = useState(0)
  const [pickedByHand, setPickedByHand] = useState(false)
  const spending = useWeekSpending(saves)

  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')

  const reload = useCallback(async () => {
    try {
      const [cats, txs, rs] = await Promise.all([listCategories(), listTransactions(), listRules()])
      setCategories(cats)
      setTransactions(txs)
      setRules(rs)
      setSaves((n) => n + 1)
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
      setPickedByHand(false)
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

  // Keyword rules: typing a note picks the category, unless one was chosen by hand.
  function changeNote(value: string) {
    setNote(value)
    if (!pickedByHand) setCategoryId(matchCategory(value, rules) ?? '')
  }

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
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value)
                setPickedByHand(true)
              }}
            >
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
          <input value={note} onChange={(e) => changeNote(e.target.value)} placeholder="Optional" />
        </label>
        {type === 'expense' && (
          <LimitWarning spending={spending} category={categories.find((c) => c.id === categoryId)} amount={Number(amount)} date={date} />
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
