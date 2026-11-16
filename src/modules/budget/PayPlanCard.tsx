import { useCallback, useEffect, useState } from 'react'
import { dateWithYear, errorText, money, todayISO } from '../../lib/format'
import { addPayRule, deletePayRule, deleteReset, endPayRule, listPayRules, listResets, setPotBalance } from './budgetService'
import type { BalanceReset, PayRule } from './potMath'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function describe(rule: PayRule): string {
  const start = new Date(rule.start_date + 'T00:00:00')
  return rule.interval === 'weekly' ? `every ${WEEKDAYS[start.getDay()]}` : `monthly on day ${start.getDate()}`
}

// The pay plan editor and the "money I have right now" tool. Used in Settings
// and as the first-time setup on the Week screen.
export function PayPlanCard({ onChange }: { onChange?: () => void }) {
  const [rules, setRules] = useState<PayRule[]>([])
  const [resets, setResets] = useState<BalanceReset[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [interval, setInterval] = useState<'weekly' | 'monthly'>('weekly')
  const [start, setStart] = useState(todayISO())
  const [ending, setEnding] = useState<{ id: string; date: string } | null>(null)
  const [balance, setBalance] = useState('')
  const [balanceDate, setBalanceDate] = useState(todayISO())

  const reload = useCallback(async () => {
    try {
      const [r, b] = await Promise.all([listPayRules(), listResets()])
      setRules(r)
      setResets(b)
    } catch (err) {
      setMessage(errorText(err, 'Could not load the pay plan'))
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function run(action: () => Promise<void>, done: string) {
    try {
      await action()
      await reload()
      setMessage(done)
      onChange?.()
    } catch (err) {
      setMessage(errorText(err, 'Could not save'))
    }
  }

  const today = todayISO()
  const lastReset = resets[resets.length - 1]

  return (
    <>
      <div className="card">
        <h3>Pay plan</h3>
        <p className="muted small">
          Add one line for each way you get paid. Weekly pay arrives on the same weekday as its start date; monthly pay on the
          same day of the month. To change your plan, end a line and add a new one. What's in your pot carries over.
        </p>
        {message && <p className="note">{message}</p>}
        {rules.length === 0 && <p className="muted small">No pay set up yet.</p>}
        {rules.map((r) => {
          const ended = r.end_date !== null && r.end_date < today
          return (
            <div className={`row ${ended ? 'muted' : ''}`} key={r.id}>
              <span>
                <b className="num">{money(r.amount)}</b> {describe(r)}
                <span className="muted small">
                  {' '}
                  · {r.start_date > today ? 'starts' : 'from'} {dateWithYear(r.start_date)}
                  {r.end_date ? ` · ${ended ? 'ended' : 'ends'} ${dateWithYear(r.end_date)}` : ''}
                </span>
              </span>
              {ending?.id === r.id ? (
                <>
                  <input type="date" value={ending.date} onChange={(e) => setEnding({ id: r.id, date: e.target.value })} aria-label="Last day of this pay" />
                  <button className="ghost inline" onClick={() => run(() => endPayRule(r.id, ending.date).then(() => setEnding(null)), 'Pay line ended')}>
                    OK
                  </button>
                </>
              ) : (
                !r.end_date && (
                  <button className="ghost inline" onClick={() => setEnding({ id: r.id, date: today })}>
                    End
                  </button>
                )
              )}
              <button
                className="link"
                aria-label={`Delete pay of ${money(r.amount)}`}
                onClick={() => {
                  if (confirm('Delete this pay line and all the pay it added to your pot? To just stop it, use End.')) {
                    run(() => deletePayRule(r.id), 'Pay line deleted')
                  }
                }}
              >
                ✕
              </button>
            </div>
          )
        })}
        <div className="row wrap">
          <input className="short" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" min="1" step="0.01" placeholder="Amount" aria-label="Pay amount" />
          <select value={interval} onChange={(e) => setInterval(e.target.value as 'weekly' | 'monthly')} aria-label="How often">
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
          </select>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start date" />
          <button
            className="primary inline"
            onClick={() =>
              run(async () => {
                await addPayRule(Number(amount), interval, start)
                setAmount('')
              }, 'Pay line added')
            }
          >
            + Add pay
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Money you have right now</h3>
        <p className="muted small">
          Sets your pot to the amount you really have. Use it when you start, or after a stretch you couldn't track: the gap is
          simply skipped and counting carries on from here.
        </p>
        {lastReset && (
          <div className="row">
            <span>
              Last set to <b className="num">{money(lastReset.amount)}</b> on {dateWithYear(lastReset.date)}
            </span>
            <button className="link" aria-label="Remove this balance" onClick={() => run(() => deleteReset(lastReset.id), 'Balance removed')}>
              ✕
            </button>
          </div>
        )}
        <div className="row wrap">
          <input className="short" value={balance} onChange={(e) => setBalance(e.target.value)} type="number" inputMode="decimal" step="0.01" placeholder="Amount" aria-label="Money you have" />
          <input type="date" value={balanceDate} max={today} onChange={(e) => setBalanceDate(e.target.value)} aria-label="As of date" />
          <button
            className="ghost inline"
            disabled={balance === ''}
            onClick={() =>
              run(async () => {
                await setPotBalance(Number(balance), balanceDate)
                setBalance('')
              }, 'Pot updated')
            }
          >
            Set
          </button>
        </div>
      </div>
    </>
  )
}
