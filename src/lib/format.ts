// Display helpers shared by every screen.

export const todayISO = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD, local time

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
