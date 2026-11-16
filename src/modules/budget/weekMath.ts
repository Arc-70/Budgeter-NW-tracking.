// Pure budget maths: the single weekly pot, rollover and soft limits.
// No database or screen code in here, so it can be tested on its own.

export interface PayChange {
  effective_from: string // YYYY-MM-DD
  amount: number
}

export interface BudgetTx {
  date: string
  amount: number
  type: 'expense' | 'income'
  category_id: string | null
}

export interface WeekSummary {
  weekStart: string
  weekEnd: string
  pay: number
  rolledOver: number // what was left (or overspent) from all earlier weeks
  income: number // extra income logged this week, on top of pay
  spent: number
  left: number
  daysLeft: number // including today
  spentByCategory: Map<string | null, number>
  history: { weekStart: string; spent: number }[] // last 6 weeks, oldest first
}

const parse = (iso: string) => new Date(iso + 'T00:00:00Z')

export function addDays(iso: string, days: number): string {
  const d = parse(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// weekStartDay: 0 = Sunday ... 6 = Saturday (the day pay arrives).
export function weekStartOf(iso: string, weekStartDay: number): string {
  const diff = (parse(iso).getUTCDay() - weekStartDay + 7) % 7
  return addDays(iso, -diff)
}

// The pay for a week is the newest pay setting that starts on or before the week's last day.
export function payForWeek(payChanges: PayChange[], weekStart: string): number {
  const weekEnd = addDays(weekStart, 6)
  let best: PayChange | null = null
  for (const p of payChanges) {
    if (p.effective_from <= weekEnd && (!best || p.effective_from > best.effective_from)) best = p
  }
  return best ? best.amount : 0
}

export function computeWeek(
  payChanges: PayChange[],
  txs: BudgetTx[],
  weekStartDay: number,
  today: string,
): WeekSummary | null {
  if (payChanges.length === 0) return null

  const earliest = payChanges.reduce((a, p) => (p.effective_from < a ? p.effective_from : a), payChanges[0].effective_from)
  const firstWeek = weekStartOf(earliest, weekStartDay)
  const weekStart = weekStartOf(today, weekStartDay)

  // Bucket every transaction by the week it falls in.
  const incomeBy = new Map<string, number>()
  const spentBy = new Map<string, number>()
  const spentByCategory = new Map<string | null, number>()
  for (const t of txs) {
    const w = weekStartOf(t.date, weekStartDay)
    if (w < firstWeek) continue
    const bucket = t.type === 'income' ? incomeBy : spentBy
    bucket.set(w, (bucket.get(w) ?? 0) + t.amount)
    if (t.type === 'expense' && w === weekStart) {
      spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + t.amount)
    }
  }

  let rolledOver = 0
  for (let w = firstWeek; w < weekStart; w = addDays(w, 7)) {
    rolledOver += payForWeek(payChanges, w) + (incomeBy.get(w) ?? 0) - (spentBy.get(w) ?? 0)
  }

  const pay = weekStart < firstWeek ? 0 : payForWeek(payChanges, weekStart)
  const income = incomeBy.get(weekStart) ?? 0
  const spent = spentBy.get(weekStart) ?? 0
  const dayIndex = (parse(today).getTime() - parse(weekStart).getTime()) / 86_400_000

  const history = []
  for (let i = 5; i >= 0; i--) {
    const w = addDays(weekStart, -7 * i)
    if (w >= firstWeek) history.push({ weekStart: w, spent: spentBy.get(w) ?? 0 })
  }

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    pay,
    rolledOver,
    income,
    spent,
    left: rolledOver + pay + income - spent,
    daysLeft: 7 - dayIndex,
    spentByCategory,
    history,
  }
}

export type LimitStatus = 'ok' | 'near' | 'over'

// Limits are suggestions: they only change the colour and show a warning.
export function limitStatus(spent: number, limit: number | null): LimitStatus {
  if (limit === null || limit <= 0) return 'ok'
  if (spent > limit) return 'over'
  return spent >= limit * 0.85 ? 'near' : 'ok'
}
