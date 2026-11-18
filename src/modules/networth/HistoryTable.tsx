import { useEffect, useRef, useState } from 'react'
import { dateWithYear, money, todayISO } from '../../lib/format'
import { Info } from '../../components/Info'
import { buildHistory, type HistoryColumn } from './netWorthMath'
import type { NetWorthData } from './netWorthService'

const round = (n: number) => money(Math.round(n))

function columnLabel(c: HistoryColumn): string {
  if (c.kind === 'today') return 'Today'
  if (c.kind === 'month-end') {
    return 'End of ' + new Date(c.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  }
  return dateWithYear(c.date)
}

// The comparison table: accounts down the side, dates across the top.
export function HistoryTable({
  data,
  onFreeze,
  onUnfreeze,
}: {
  data: NetWorthData
  onFreeze: (date: string, usdRate: number, typed: Map<string, number>, carryForward: boolean) => void
  onUnfreeze: (snapshotId: string) => void
}) {
  const today = todayISO()
  const history = buildHistory(data.categories, data.accounts, data.balances, data.snapshots, data.usdRate, today)
  const scroller = useRef<HTMLDivElement>(null)
  const [adding, setAdding] = useState(false)

  // Start scrolled to the newest column.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [history.columns.length])

  const assets = history.rows.filter((r) => r.category.kind === 'asset')
  const liabilities = history.rows.filter((r) => r.category.kind === 'liability')
  const frozenToday = data.snapshots.some((s) => s.date === today)
  const cell = (v: number | null, key: number) => (
    <td className="r num" key={key}>
      {v === null ? '' : round(v)}
    </td>
  )

  return (
    <div className="card">
      <div className="head">
        <h3>
          History
          <Info>
            Each month gets a column automatically, using the balances as they stood at its end. Freeze a date to keep it as its own
            fixed column for comparing later.
          </Info>
        </h3>
        <div className="row tight">
          <button
            className="ghost inline"
            disabled={frozenToday || history.rows.length === 0}
            onClick={() => onFreeze(today, data.usdRate, new Map(), true)}
          >
            {frozenToday ? 'Frozen today' : 'Freeze today'}
          </button>
          <button className="ghost inline" onClick={() => setAdding(!adding)}>
            {adding ? 'Cancel' : '+ Past date'}
          </button>
        </div>
      </div>

      {adding && <PastSnapshot data={data} onSave={(...args) => { onFreeze(...args); setAdding(false) }} />}

      {history.columns.length === 0 ? (
        <p className="muted small">Add an account and a balance to start your history.</p>
      ) : (
        <div className="scroll" ref={scroller}>
          <table className="history">
            <thead>
              <tr>
                <th>Account</th>
                {history.columns.map((c) => (
                  <th className="r" key={c.date}>
                    {columnLabel(c)}
                    {c.snapshot && (
                      <button className="link" aria-label={`Unfreeze ${columnLabel(c)}`} title="Unfreeze this date" onClick={() => onUnfreeze(c.snapshot!.id)}>
                        ✕
                      </button>
                    )}
                    <div className="muted">{c.kind === 'frozen' ? 'frozen' : 'auto'}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="group">
                <th colSpan={history.columns.length + 1}>Assets</th>
              </tr>
              {assets.map((r) => (
                <tr key={r.account.id}>
                  <th>{r.account.name}</th>
                  {r.values.map(cell)}
                </tr>
              ))}
              <tr className="total">
                <th>Total assets</th>
                {history.columns.map((c, i) => cell(c.assets, i))}
              </tr>
              <tr className="group">
                <th colSpan={history.columns.length + 1}>Liabilities</th>
              </tr>
              {liabilities.map((r) => (
                <tr key={r.account.id}>
                  <th>{r.account.name}</th>
                  {r.values.map(cell)}
                </tr>
              ))}
              <tr className="total">
                <th>Total liabilities</th>
                {history.columns.map((c) => (
                  <td className={`r num ${c.liabilities > 0 ? 'neg' : ''}`} key={c.date}>
                    {round(-c.liabilities)}
                  </td>
                ))}
              </tr>
              <tr className="grand">
                <th>Net worth</th>
                {history.columns.map((c, i) => cell(c.netWorth, i))}
              </tr>
              <tr className="grand">
                <th>Change</th>
                {history.columns.map((c) => (
                  <td className={`r num ${c.change !== null && c.change < 0 ? 'neg' : c.change ? 'pos' : ''}`} key={c.date}>
                    {c.change === null ? '' : (c.change > 0 ? '+' : '') + round(c.change)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Form for entering a snapshot of an earlier date, e.g. from an old spreadsheet.
function PastSnapshot({
  data,
  onSave,
}: {
  data: NetWorthData
  onSave: (date: string, usdRate: number, typed: Map<string, number>, carryForward: boolean) => void
}) {
  const [date, setDate] = useState('')
  const [rate, setRate] = useState(String(data.usdRate))
  const [values, setValues] = useState<Record<string, string>>({})
  const open = data.accounts.filter((a) => !a.closed_on || (date !== '' && a.closed_on > date))

  return (
    <div className="past">
      <div className="row wrap">
        <label>
          <span>
            Date
            <Info>
              Leave an account empty if it had no balance yet, or to keep whatever it was before that date. Add accounts you no
              longer have first, then close them.
            </Info>
          </span>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          ฿ per $1 on that date
          <input className="short" type="number" inputMode="decimal" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      </div>
      {open.map((a) => (
        <div className="row" key={a.id}>
          <span>{a.name}</span>
          <input
            className="short"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder={a.currency}
            aria-label={`Balance of ${a.name} on that date`}
            value={values[a.id] ?? ''}
            onChange={(e) => setValues({ ...values, [a.id]: e.target.value })}
          />
        </div>
      ))}
      <button
        className="primary"
        disabled={date === ''}
        onClick={() => {
          const typed = new Map(Object.entries(values).filter(([, v]) => v !== '').map(([id, v]) => [id, Number(v)]))
          onSave(date, Number(rate), typed, false)
        }}
      >
        Save and freeze this date
      </button>
    </div>
  )
}
