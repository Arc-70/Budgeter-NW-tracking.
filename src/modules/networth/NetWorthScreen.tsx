import { useCallback, useEffect, useState } from 'react'
import { dateWithYear, errorText, money, shortDate, todayISO } from '../../lib/format'
import { HistoryTable } from './HistoryTable'
import { series, summarize, type AccountRow, type Currency } from './netWorthMath'
import {
  addAccount, addNwCategory, closeAccount, deleteAccount, deleteNwCategory, deleteSnapshot, freezeSnapshot, loadNetWorth, setBalance,
  type NetWorthData,
} from './netWorthService'
import { TrendChart } from './TrendChart'

export function NetWorthScreen() {
  const [data, setData] = useState<NetWorthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setData(await loadNetWorth())
    } catch (err) {
      setError(errorText(err, 'Could not load net worth'))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function run(action: () => Promise<unknown>) {
    try {
      await action()
      setError(null)
      await reload()
    } catch (err) {
      setError(errorText(err, 'Could not save'))
    }
  }

  if (!data) return <p className={error ? 'error' : 'muted'}>{error ?? 'Loading…'}</p>

  const summary = summarize(data.categories, data.accounts, data.balances, data.usdRate)
  const trend = series(data.categories, data.accounts, data.balances, data.usdRate)
  const previous = trend.length > 1 ? trend[trend.length - 2] : null
  const change = previous ? summary.total - previous.total : 0
  const widest = Math.max(1, ...summary.byCategory.map((c) => Math.abs(c.total)))

  return (
    <div className="stack">
      <h2>Net worth</h2>
      {error && <p className="error">{error}</p>}

      <div className="two wide-left">
        <div className="card">
          <h3>Total net worth</h3>
          <div className={`hero num ${summary.total < 0 ? 'neg' : ''}`}>{money(Math.round(summary.total))}</div>
          {previous && (
            <p className="small">
              <b className={change >= 0 ? 'pos' : 'neg'}>
                {change >= 0 ? '▲' : '▼'} {money(Math.abs(Math.round(change)))}
              </b>{' '}
              <span className="muted">since {shortDate(previous.date)}</span>
            </p>
          )}
          <TrendChart points={trend} />
        </div>

        <div className="card">
          <h3>By category</h3>
          {summary.byCategory.map(({ category, total }) => (
            <div className={`rank ${category.kind === 'liability' ? 'debt' : ''}`} key={category.id}>
              <span>{category.name}</span>
              <div className="bar">
                <i style={{ width: `${(Math.abs(total) / widest) * 100}%` }} />
              </div>
              <b className="num">{money(Math.round(total))}</b>
              <button
                className="link"
                aria-label={`Delete ${category.name}`}
                onClick={() => {
                  if (confirm(`Delete "${category.name}" and every account in it?`)) run(() => deleteNwCategory(category.id))
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <AddCategory onAdd={(name, kind) => run(() => addNwCategory(name, kind))} />
        </div>
      </div>

      <div className="card">
        <h3>Accounts</h3>
        {summary.accounts.length === 0 && <p className="muted small">No accounts yet. Add your first one below.</p>}
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Category</th>
                <th>Last updated</th>
                <th className="r">Balance</th>
                <th className="r">In THB</th>
                <th>New balance</th>
              </tr>
            </thead>
            <tbody>
              {summary.accounts.map((row) => (
                <Account
                  key={row.account.id}
                  row={row}
                  onSave={(balance) => run(() => setBalance(row.account.id, todayISO(), balance))}
                  onClose={(date) => run(() => closeAccount(row.account.id, date))}
                  onDelete={() => run(() => deleteAccount(row.account.id))}
                />
              ))}
            </tbody>
          </table>
        </div>
        <AddAccount
          categories={data.categories}
          onAdd={(name, categoryId, currency, balance) =>
            run(async () => {
              const id = await addAccount(name, categoryId, currency)
              if (balance !== null) await setBalance(id, todayISO(), balance)
            })
          }
        />
        <p className="muted small">
          For debts, type the amount you owe as a positive number. USD is converted at ฿{data.usdRate} per $1 (change it in Settings).
          Close keeps an account in your history; ✕ deletes it and its history.
        </p>
        {data.accounts.filter((a) => a.closed_on).map((a) => (
          <div className="row muted small" key={a.id}>
            <span>
              {a.name} · closed {dateWithYear(a.closed_on!)}
            </span>
            <button className="ghost inline" onClick={() => run(() => closeAccount(a.id, null))}>
              Reopen
            </button>
            <button
              className="link"
              aria-label={`Delete ${a.name}`}
              onClick={() => {
                if (confirm(`Delete "${a.name}" and its history for good?`)) run(() => deleteAccount(a.id))
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <HistoryTable
        data={data}
        onFreeze={(date, rate, typed, carryForward) => run(() => freezeSnapshot(data, date, rate, typed, carryForward))}
        onUnfreeze={(id) => run(() => deleteSnapshot(id))}
      />
    </div>
  )
}

function Account({ row, onSave, onClose, onDelete }: {
  row: AccountRow
  onSave: (balance: number) => void
  onClose: (date: string) => void
  onDelete: () => void
}) {
  const [value, setValue] = useState('')
  const [closing, setClosing] = useState<string | null>(null) // the closing date being chosen
  const { account, category } = row
  return (
    <tr>
      <td>{account.name}</td>
      <td className="muted">{category.name}</td>
      <td className="muted">{row.lastUpdated ? shortDate(row.lastUpdated) : 'Never'}</td>
      <td className="r num">{row.balance === null ? '—' : money(row.balance, account.currency)}</td>
      <td className="r num">{row.balance === null ? '—' : money(Math.round(row.thb))}</td>
      <td>
        <div className="row tight">
          <input
            className="short"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder={account.currency}
            aria-label={`New balance for ${account.name}`}
          />
          <button
            className="ghost inline"
            disabled={value === ''}
            onClick={() => {
              onSave(Number(value))
              setValue('')
            }}
          >
            Save
          </button>
          {closing === null ? (
            <button className="ghost inline" onClick={() => setClosing(todayISO())}>
              Close
            </button>
          ) : (
            <>
              <input type="date" value={closing} max={todayISO()} onChange={(e) => setClosing(e.target.value)} aria-label={`Closing date for ${account.name}`} />
              <button className="ghost inline" onClick={() => onClose(closing)}>
                OK
              </button>
            </>
          )}
          <button
            className="link"
            aria-label={`Delete ${account.name}`}
            onClick={() => {
              if (confirm(`Delete "${account.name}" and its history?`)) onDelete()
            }}
          >
            ✕
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddCategory({ onAdd }: { onAdd: (name: string, kind: 'asset' | 'liability') => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<'asset' | 'liability'>('asset')
  return (
    <div className="row wrap">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
      <select value={kind} onChange={(e) => setKind(e.target.value as 'asset' | 'liability')} aria-label="Category type">
        <option value="asset">Something I own</option>
        <option value="liability">Something I owe</option>
      </select>
      <button
        className="ghost inline"
        onClick={() => {
          onAdd(name, kind)
          setName('')
        }}
      >
        + Add category
      </button>
    </div>
  )
}

function AddAccount({
  categories,
  onAdd,
}: {
  categories: NetWorthData['categories']
  onAdd: (name: string, categoryId: string, currency: Currency, balance: number | null) => void
}) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [currency, setCurrency] = useState<Currency>('THB')
  const [balance, setBalance] = useState('')
  return (
    <div className="row wrap">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New account name" />
      <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Account category">
        <option value="">Category…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} aria-label="Currency">
        <option value="THB">THB</option>
        <option value="USD">USD</option>
      </select>
      <input
        className="short"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="Balance"
      />
      <button
        className="primary inline"
        onClick={() => {
          onAdd(name, categoryId, currency, balance === '' ? null : Number(balance))
          setName('')
          setBalance('')
        }}
      >
        + Add account
      </button>
    </div>
  )
}
