// Reads the text inside a slip's QR code. Pure logic, no camera or image code.
//
// Standard bank slips ("slip verify" mini-QR) hold the sending bank's code and
// the transaction reference. They do NOT hold the amount.

import { bankName, TRUEMONEY } from './banks'

export interface SlipQr {
  bank: string
  ref: string
  dedupeKey: string // unique per transfer; used to block adding the same slip twice
  dateHint: string | null // YYYY-MM-DD when the QR itself carries the date
}

// QR text is a chain of fields: 2-digit tag, 2-digit length, then the value.
export function parseTlv(text: string): Map<string, string> | null {
  const fields = new Map<string, string>()
  let i = 0
  while (i < text.length) {
    const tag = text.slice(i, i + 2)
    const length = Number(text.slice(i + 2, i + 4))
    if (!/^\d{2}$/.test(tag) || !Number.isInteger(length) || i + 4 + length > text.length) return null
    fields.set(tag, text.slice(i + 4, i + 4 + length))
    i += 4 + length
  }
  return fields.size > 0 ? fields : null
}

function validDate(year: number, month: number, day: number, today: string): string | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
  const iso = d.toISOString().slice(0, 10)
  return year >= 2015 && iso <= today ? iso : null
}

export function parseSlipQr(text: string, today: string): SlipQr | null {
  const root = parseTlv(text.trim())
  const inner = root?.get('00') ? parseTlv(root.get('00')!) : null
  if (!inner) return null

  // Standard bank slip: 00 = API id, 01 = bank code, 02 = transaction reference.
  const bankCode = inner.get('01')
  const ref = inner.get('02')
  if (inner.get('00')?.length === 6 && bankCode && /^\d{3}$/.test(bankCode) && ref) {
    // Several banks start the reference with the date as YYYYMMDD.
    const m = ref.match(/^(\d{4})(\d{2})(\d{2})/)
    return {
      bank: bankName(bankCode),
      ref,
      dedupeKey: `${bankCode}:${ref}`,
      dateHint: m ? validDate(Number(m[1]), Number(m[2]), Number(m[3]), today) : null,
    }
  }

  // TrueMoney variant: carries a transaction id and a DDMMYYYY date.
  // Built from third-party documentation and not yet checked against a real TrueMoney slip.
  const values = [...inner.values()]
  const dateField = values.find((v) => /^\d{8}$/.test(v))
  const id = values.filter((v) => v !== dateField).sort((a, b) => b.length - a.length)[0]
  if (dateField && id && id.length >= 8) {
    return {
      bank: TRUEMONEY,
      ref: id,
      dedupeKey: `TMN:${id}`,
      dateHint: validDate(Number(dateField.slice(4)), Number(dateField.slice(2, 4)), Number(dateField.slice(0, 2)), today),
    }
  }
  return null
}
