// Pure maths for the daily pool: pay spread evenly over each day of the
// calendar month. Unspent money carries to the next day; the pool starts
// fresh on the 1st. No database or screen code in here.

import { addDays, daysBetween } from './weekMath'
import { monthlyDate, type BudgetTx, type PayRule } from './potMath'

// What one pay line is worth per day on `day`: its amount divided by the
// number of days its pay period covers (7 for weekly, 30 for a 30-day month...).
export function ruleRateOn(rule: PayRule, day: string): number {
  if (day < rule.start_date || (rule.end_date && day > rule.end_date)) return 0
  const every = Math.max(1, Math.floor(rule.every))
  if (rule.interval === 'daily') return rule.amount / every
  if (rule.interval === 'weekly') return rule.amount / (7 * every)

  // Monthly: find the pay period that contains `day`.
  const [y, m, d] = rule.start_date.split('-').map(Number)
  const [dy, dm] = day.split('-').map(Number)
  let k = Math.floor(((dy - y) * 12 + (dm - m)) / every)
  let from = monthlyDate(y, m - 1 + k * every, d)
  if (from > day) {
    k -= 1
    from = monthlyDate(y, m - 1 + k * every, d)
  }
  const to = monthlyDate(y, m - 1 + (k + 1) * every, d)
  return rule.amount / daysBetween(from, to)
}

export const dailyRateOn = (rules: PayRule[], day: string) => rules.reduce((sum, r) => sum + ruleRateOn(r, day), 0)

export interface DailyPool {
  monthStart: string
  monthEnd: string
  ratePerDay: number // today's daily amount
  available: number // what can still be spent today, including days saved up
  carried: number // brought into today from earlier days this month (negative = overspent)
  spentToday: number
  spentThisMonth: number
  monthTotal: number // the whole month's daily amounts added up
}

export function computeDailyPool(rules: PayRule[], txs: BudgetTx[], today: string): DailyPool {
  const monthStart = today.slice(0, 8) + '01'
  const [year, month] = today.split('-').map(Number)
  const monthEnd = monthlyDate(year, month - 1, 31)

  let earnedSoFar = 0
  let monthTotal = 0
  for (let day = monthStart; day <= monthEnd; day = addDays(day, 1)) {
    const rate = dailyRateOn(rules, day)
    monthTotal += rate
    if (day <= today) earnedSoFar += rate
  }

  let spentThisMonth = 0
  let spentToday = 0
  for (const t of txs) {
    if (t.type !== 'expense' || t.date < monthStart || t.date > today) continue
    spentThisMonth += t.amount
    if (t.date === today) spentToday += t.amount
  }

  const ratePerDay = dailyRateOn(rules, today)
  const available = earnedSoFar - spentThisMonth
  return {
    monthStart,
    monthEnd,
    ratePerDay,
    available,
    carried: available + spentToday - ratePerDay,
    spentToday,
    spentThisMonth,
    monthTotal,
  }
}

// How far past the daily pool an expense would go. 0 = fine.
export function overDailyBy(pool: DailyPool | null | undefined, amount: number, date: string, today: string): number {
  if (!pool || !(amount > 0) || date < pool.monthStart || date > today) return 0
  return Math.max(0, amount - Math.max(0, pool.available))
}
