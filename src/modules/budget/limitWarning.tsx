import { useEffect, useState } from 'react'
import { money, todayISO } from '../../lib/format'
import type { Category } from '../transactions/types'
import { loadBudgetData } from './budgetService'
import { computeWeek } from './weekMath'

export interface WeekSpending {
  weekStart: string
  weekEnd: string
  spentByCategory: Map<string | null, number>
}

// This week's spending per category. `refreshKey` reloads it after a save.
export function useWeekSpending(refreshKey = 0): WeekSpending | null {
  const [spending, setSpending] = useState<WeekSpending | null>(null)
  useEffect(() => {
    loadBudgetData()
      .then((d) => setSpending(computeWeek(d.payChanges, d.txs, d.weekStartDay, todayISO())))
      .catch(() => setSpending(null)) // the warning is a nicety; never block entry over it
  }, [refreshKey])
  return spending
}

// How far over its soft limit a category would be after adding `amount`. 0 = fine.
export function overLimitBy(spending: WeekSpending | null, category: Category | undefined, amount: number, date: string): number {
  if (!spending || !category?.weekly_limit || !(amount > 0)) return 0
  if (date < spending.weekStart || date > spending.weekEnd) return 0 // limits are for the current week
  return Math.max(0, (spending.spentByCategory.get(category.id) ?? 0) + amount - category.weekly_limit)
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
      {category.name} will be {money(over)} over its {money(category.weekly_limit!)} limit this week. You can still save.
    </p>
  )
}
