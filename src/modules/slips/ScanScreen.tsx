import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { errorText, todayISO } from '../../lib/format'
import { LimitWarning, useWeekSpending } from '../budget/limitWarning'
import { matchCategory, type Rule } from '../rules/matchCategory'
import { listRules } from '../rules/rulesService'
import { addSlipTransaction, listCategories, slipAlreadyAdded } from '../transactions/transactionService'
import type { Category } from '../transactions/types'
import { readSlip, type SlipDraft } from './readSlip'

type Stage = 'pick' | 'reading' | 'confirm'

export function ScanScreen() {
  const [stage, setStage] = useState<Stage>('pick')
  const [categories, setCategories] = useState<Category[]>([])
  const [draft, setDraft] = useState<SlipDraft | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The confirm form. Everything the reader found is editable.
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [rules, setRules] = useState<Rule[]>([])
  const [pickedByHand, setPickedByHand] = useState(false)
  const [saves, setSaves] = useState(0)
  const spending = useWeekSpending(saves)

  useEffect(() => {
    Promise.all([listCategories(), listRules()])
      .then(([cats, rs]) => {
        setCategories(cats)
        setRules(rs)
      })
      .catch((err) => setError(errorText(err, 'Could not load categories')))
  }, [])

  // Keyword rules: your note is checked first, then the words on the slip itself.
  const suggest = (noteText: string, slipText: string) => matchCategory(noteText, rules) ?? matchCategory(slipText, rules) ?? ''

  function changeNote(value: string) {
    setNote(value)
    if (!pickedByHand && draft) setCategoryId(suggest(value, draft.text))
  }

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // so the same file can be picked again
    if (!file) return
    setError(null)
    setMessage(null)
    setStage('reading')
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    try {
      const result = await readSlip(file, todayISO())
      setDraft(result)
      setAmount(result.amount === null ? '' : String(result.amount))
      setDate(result.date ?? todayISO())
      setNote(result.memo ?? '') // start from the memo written on the slip, if there is one
      setPickedByHand(false)
      setCategoryId(suggest(result.memo ?? '', result.text))
      setDuplicate(result.dedupeKey ? await slipAlreadyAdded(result.dedupeKey) : false)
      setStage('confirm')
    } catch (err) {
      setError(errorText(err, 'Could not read that image'))
      setStage('pick')
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    try {
      await addSlipTransaction(
        { type: 'expense', amount: Number(amount), date, category_id: categoryId || null, note: note.trim() || null },
        draft.dedupeKey,
      )
      setSaves((n) => n + 1)
      setMessage('Saved. Scan another slip whenever you like.')
      setDraft(null)
      setStage('pick')
    } catch (err) {
      setError(errorText(err, 'Could not save'))
    }
  }

  const picker = (label: string, className: string) => (
    <label className={`${className} file`}>
      {label}
      <input className="visually-hidden" type="file" accept="image/*" onChange={pick} />
    </label>
  )

  if (stage === 'reading') {
    return (
      <div className="stack narrow">
        <h2>Scan slip</h2>
        <div className="card">
          {preview && <img className="slip-img" src={preview} alt="The slip being read" />}
          <p>Reading the slip on this device…</p>
          <p className="muted small">The first scan takes longer while the reader loads.</p>
        </div>
      </div>
    )
  }

  if (stage === 'confirm' && draft) {
    return (
      <form className="stack narrow" onSubmit={save}>
        <h2>Check slip</h2>
        <div className="card">
          {preview && <img className="slip-img" src={preview} alt="The slip that was read" />}
          <p className="small">
            <b>{draft.bank ?? 'Bank not recognised'}</b>
            <span className="muted">
              {!draft.dedupeKey
                ? ' · no QR or transaction ID found, so duplicates cannot be checked'
                : draft.dedupeKey.startsWith('TXT:')
                  ? ' · no QR, using the printed transaction ID to spot duplicates'
                  : ' · QR read'}
            </span>
          </p>
          {duplicate && <p className="note">This slip has already been added. Saving it again will be refused.</p>}
          {draft.amount === null && <p className="note">Could not read the amount. Type it in below.</p>}
          {draft.date === null && <p className="note">Could not read the date, so today is filled in. Check it.</p>}
          <label>
            Amount (THB)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" inputMode="decimal" min="0" step="0.01" required />
          </label>
          <label>
            Date
            <input value={date} onChange={(e) => setDate(e.target.value)} type="date" max={todayISO()} required />
          </label>
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
          <label>
            Note
            <input value={note} onChange={(e) => changeNote(e.target.value)} placeholder="Optional, for yourself" />
          </label>
          <LimitWarning spending={spending} category={categories.find((c) => c.id === categoryId)} amount={Number(amount)} date={date} />
          <p className="muted small">Read on this device. Fix anything that's wrong before saving.</p>
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={duplicate}>
            Looks right, save
          </button>
          {picker('Scan a different slip', 'ghost')}
        </div>
      </form>
    )
  }

  return (
    <div className="stack narrow">
      <h2>Scan slip</h2>
      <div className="card">
        {message && <p className="note">{message}</p>}
        <p>Pick a slip screenshot or take a photo of one.</p>
        <p className="muted small">
          The image is read on this device and never uploaded. Works with SCB, Kasikorn (K PLUS and MAKE), Bangkok Bank and
          TrueMoney slips; you confirm everything before it saves.
        </p>
        {error && <p className="error">{error}</p>}
        {picker('Choose slip', 'primary')}
      </div>
    </div>
  )
}
