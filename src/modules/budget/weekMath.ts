// Pure date and limit helpers for the budget. The pot itself is in potMath.ts.
// No database or screen code in here, so it can be tested on its own.

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

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000)
}

export type LimitStatus = 'ok' | 'near' | 'over'

// Limits are suggestions: they only change the colour and show a warning.
export function limitStatus(spent: number, limit: number | null): LimitStatus {
  if (limit === null || limit <= 0) return 'ok'
  if (spent > limit) return 'over'
  return spent >= limit * 0.85 ? 'near' : 'ok'
}
