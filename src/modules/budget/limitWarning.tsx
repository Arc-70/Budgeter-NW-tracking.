import { useEffect, useState } from 'react'
import { money, todayISO } from '../../lib/format'
import type { Category } from '../transactions/types'
import { loadBudgetData, potFor } from './budgetService'

export interface WeekSpending {
  weekStart: string
  weekEnd: string
  spentByCategory: Map<string | null, number>
  monthStart: string
  monthEnd: string
  spentByCategoryMonth: Map<string | null, number>
}

// This week's spending per category. `refreshKey` reloads it after a save.
export function useWeekSpending(refreshKey = 0): WeekSpending | null {
  const [spending, setSpending] = useState<WeekSpending | null>(null)
  useEffect(() => {
    loadBudgetData()
      .then((d) => setSpending(potFor(d, todayISO())))
      .catch(() => setSpending(null)) // the warning is a nicety; never block entry over it
  }, [refreshKey])
  return spending
}

// How far over its soft limit a category would be after adding `amount`. 0 = fine.
// A limit covers either the current week or the current calendar month.
export function overLimitBy(spending: WeekSpending | null, category: Category | undefined, amount: number, date: string): number {
  if (!spending || !category?.weekly_limit || !(amount > 0)) return 0
  const monthly = category.limit_period === 'monthly'
  const [start, end] = monthly ? [spending.monthStart, spending.monthEnd] : [spending.weekStart, spending.weekEnd]
  if (date < start || date > end) return 0 // limits only apply to the current period
  const spent = (monthly ? spending.spentByCategoryMonth : spending.spentByCategory).get(category.id) ?? 0
  return Math.max(0, spent + amount - category.weekly_limit)
}

// Soft limit: warns, never blocks.
export function LimitWarning({ spending, category, amount, date }: {
  spending: WeekSpending | null
  category: Category | undefined
  amount: number
  date: string
}) {
  const over = overLimitBy(spending, category, amount, date)
  if (over <= 0 || !category) return null
  return (
    <p className="note">
      {category.name} will be {money(over)} over its {money(category.weekly_limit!)} limit this{' '}
      {category.limit_period === 'monthly' ? 'month' : 'week'}. You can still save.
    </p>
  )
}
