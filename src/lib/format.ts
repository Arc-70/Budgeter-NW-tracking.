// Display helpers shared by every screen.

// Today's date as YYYY-MM-DD in the device's own time zone. Built by hand
// because date formatting by locale is not identical across browsers.
export function todayISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function money(n: number, currency: 'THB' | 'USD' = 'THB'): string {
  const symbol = currency === 'USD' ? '$' : '฿'
  const digits = Number.isInteger(n) ? 0 : 2
  const body = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })
  return `${n < 0 ? '-' : ''}${symbol}${body}`
}

export function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export const errorText = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback)

// "20 Nov 26" - used where the year matters (history, pay plans).
export function dateWithYear(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
}
