// Pure maths for the single cash pot: pay plans, "I have this much" resets,
// and what is left. No database or screen code in here.

import { addDays, daysBetween, weekStartOf } from './weekMath'

// One line of a pay plan. Weekly pay arrives every 7 days from start_date;
// monthly pay arrives on the same day of the month as start_date.
export interface PayRule {
  id: string
  amount: number
  interval: 'weekly' | 'monthly'
  start_date: string // YYYY-MM-DD
  end_date: string | null // last day the rule applies; null = still running
}

// "I have this much money as of this date." Everything before it is ignored.
export interface BalanceReset {
  id: string
  date: string
  amount: number
  created_at: string
}

export interface BudgetTx {
  date: string
  amount: number
  type: 'expense' | 'income'
  category_id: string | null
  created_at: string
}

export interface PotSummary {
  hasPlan: boolean // false until a pay rule or a balance is set
  pot: number // cash left right now
  since: { date: string; amount: number } | null // the reset the pot is counted from
  weekStart: string
  weekEnd: string
  spentThisWeek: number
  paidThisWeek: number // pay that arrived this week
  spentByCategory: Map<string | null, number>
  history: { weekStart: string; spent: number }[] // last 6 weeks, oldest first
  nextPays: { rule: PayRule; date: string; inDays: number }[] // soonest first
}

// Day `day` of a month, or the month's last day if it is shorter (31st -> 30 Nov).
function monthlyDate(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

// Every date a rule pays out between `from` and `to`, both included.
export function payDates(rule: PayRule, from: string, to: string): string[] {
  const end = rule.end_date && rule.end_date < to ? rule.end_date : to
  const dates: string[] = []
  if (rule.interval === 'weekly') {
    let d = rule.start_date
    if (d < from) d = addDays(d, Math.ceil(daysBetween(d, from) / 7) * 7)
    for (; d <= end; d = addDays(d, 7)) dates.push(d)
  } else {
    const [year, month, day] = rule.start_date.split('-').map(Number)
    for (let i = 0; ; i++) {
      const d = monthlyDate(year, month - 1 + i, day)
      if (d > end) break
      if (d >= from) dates.push(d)
    }
  }
  return dates
}

export function nextPayDate(rule: PayRule, today: string): string | null {
  const horizon = addDays(today, 62)
  return payDates(rule, addDays(today, 1), rule.start_date > horizon ? rule.start_date : horizon)[0] ?? null
}

// The week (for category limits and the weekly chart) starts on the weekday the
// weekly pay arrives. Without a weekly rule it falls back to the given day.
export function weekStartDayFor(rules: PayRule[], today: string, fallback: number): number {
  const weekly = rules
    .filter((r) => r.interval === 'weekly' && r.start_date <= today && (!r.end_date || r.end_date >= today))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
  return weekly ? new Date(weekly.start_date + 'T00:00:00Z').getUTCDay() : fallback
}

export function computePot(
  rules: PayRule[],
  resets: BalanceReset[],
  txs: BudgetTx[],
  fallbackWeekStartDay: number,
  today: string,
): PotSummary {
  // Where counting starts: the newest reset, or else the first pay rule's start.
  const reset = resets.filter((r) => r.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  const firstStart = rules.reduce<string | null>((a, r) => (a === null || r.start_date < a ? r.start_date : a), null)
  const payFrom = reset ? addDays(reset.date, 1) : firstStart // pay on the reset day is already in the typed amount

  const counts = (t: BudgetTx) => {
    if (t.date > today) return false
    if (reset) return t.date > reset.date || (t.date === reset.date && t.created_at > reset.created_at)
    return firstStart !== null && t.date >= firstStart
  }

  let pot = reset ? reset.amount : 0
  if (payFrom) {
    for (const rule of rules) pot += payDates(rule, payFrom, today).length * rule.amount
  }
  for (const t of txs) {
    if (counts(t)) pot += t.type === 'income' ? t.amount : -t.amount
  }

  // Weekly figures cover all spending, whether or not it is before a reset.
  const weekStartDay = weekStartDayFor(rules, today, fallbackWeekStartDay)
  const weekStart = weekStartOf(today, weekStartDay)
  const weekEnd = addDays(weekStart, 6)
  const spentByWeek = new Map<string, number>()
  const spentByCategory = new Map<string | null, number>()
  for (const t of txs) {
    if (t.type !== 'expense' || t.date > today) continue
    const w = weekStartOf(t.date, weekStartDay)
    spentByWeek.set(w, (spentByWeek.get(w) ?? 0) + t.amount)
    if (w === weekStart) spentByCategory.set(t.category_id, (spentByCategory.get(t.category_id) ?? 0) + t.amount)
  }

  const history = []
  for (let i = 5; i >= 0; i--) {
    const w = addDays(weekStart, -7 * i)
    history.push({ weekStart: w, spent: spentByWeek.get(w) ?? 0 })
  }

  const nextPays = rules
    .map((rule) => ({ rule, date: nextPayDate(rule, today) }))
    .filter((n): n is { rule: PayRule; date: string } => n.date !== null)
    .map((n) => ({ ...n, inDays: daysBetween(today, n.date) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    hasPlan: rules.length > 0 || resets.length > 0,
    pot,
    since: reset ? { date: reset.date, amount: reset.amount } : null,
    weekStart,
    weekEnd,
    spentThisWeek: spentByWeek.get(weekStart) ?? 0,
    paidThisWeek: rules.reduce((sum, r) => sum + payDates(r, weekStart, today).length * r.amount, 0),
    spentByCategory,
    history,
    nextPays,
  }
}
