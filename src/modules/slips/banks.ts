// Bank of Thailand codes, as found in the QR on a transfer slip.
const BANKS: Record<string, string> = {
  '002': 'Bangkok Bank',
  '004': 'Kasikorn (K PLUS / MAKE)',
  '006': 'Krungthai',
  '011': 'TTB',
  '014': 'SCB',
  '025': 'Krungsri',
  '030': 'GSB',
  '034': 'BAAC',
  '069': 'Kiatnakin Phatra',
  '073': 'LH Bank',
}

export const TRUEMONEY = 'TrueMoney'

export function bankName(code: string): string {
  return BANKS[code] ?? `Bank ${code}`
}

// Fallback when there is no readable QR: look for the app's own name in the slip text.
export function bankFromText(text: string): string | null {
  const t = text.toLowerCase()
  if (/true\s?money|ทรูมันนี่/.test(t)) return TRUEMONEY
  if (/verified by k\+|k\s?plus|make by kbank/.test(t)) return BANKS['004']
  if (/bangkok bank/.test(t)) return BANKS['002']
  if (/\bscb\b/.test(t)) return BANKS['014']
  return null
}
