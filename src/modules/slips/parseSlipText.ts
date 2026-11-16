// Finds the amount, date and recipient in the text that OCR read from a slip.
// Pure logic: it looks for labels ("จำนวนเงิน", "Amount", ...) rather than fixed
// positions, so one reader covers every bank's layout.

export interface SlipText {
  amount: number | null
  date: string | null // YYYY-MM-DD
  recipient: string | null
}

const MONEY = /(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?!\d)/
const AMOUNT_LABEL = /จำนวน|amount|ยอดโอน|ยอดชำระ/i
const NOT_AMOUNT = /ค่า|ธรรมเนียม|fee|คงเหลือ|remaining|balance/i
const TO_LABEL = /^(ไปยัง|ไปที่|ถึง|To)(?=[\s:]|$)/

const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const TH_SHORT: Record<string, number> = {
  มค: 1, กพ: 2, มีค: 3, เมย: 4, พค: 5, มิย: 6, กค: 7, สค: 8, กย: 9, ตค: 10, พย: 11, ธค: 12,
}
const TH_FULL = ['มกรา', 'กุมภา', 'มีนา', 'เมษา', 'พฤษภา', 'มิถุนา', 'กรกฎา', 'สิงหา', 'กันยา', 'ตุลา', 'พฤศจิกา', 'ธันวา']
// Consonants only, for when OCR adds or drops a vowel mark ("พ.ุย." for "พ.ย.").
const TH_CONSONANTS: Record<string, number> = { กพ: 2, พค: 5, กค: 7, สค: 8, กย: 9, ตค: 10, พย: 11, ธค: 12 }

// OCR often writes "ำ" as two separate marks; put them back together.
export const normalize = (text: string) => text.normalize('NFC').replace(/ํา/g, 'ำ')

const toNumber = (s: string) => Number(s.replace(/,/g, ''))

export function findAmount(lines: string[]): number | null {
  // Preferred: the first money value on, or just below, an "amount" label.
  for (let i = 0; i < lines.length; i++) {
    if (!AMOUNT_LABEL.test(lines[i]) || NOT_AMOUNT.test(lines[i])) continue
    for (let j = i; j <= i + 2 && j < lines.length; j++) {
      if (j > i && NOT_AMOUNT.test(lines[j])) break
      const m = lines[j].match(MONEY)
      if (m) return toNumber(m[0])
    }
  }
  // Fallback: the first non-zero money value that is not a fee or a balance.
  for (const line of lines) {
    const m = NOT_AMOUNT.test(line) ? null : line.match(MONEY)
    if (m && toNumber(m[0]) > 0) return toNumber(m[0])
  }
  return null
}

// Returns the month number and whether the month was written in Thai.
export function findMonth(token: string): { month: number; thai: boolean } | null {
  const clean = token.replace(/[.\s]/g, '')
  const en = EN_MONTHS.indexOf(clean.slice(0, 3).toLowerCase())
  if (en >= 0) return { month: en + 1, thai: false }

  if (TH_SHORT[clean]) return { month: TH_SHORT[clean], thai: true }
  const full = TH_FULL.findIndex((name) => clean.startsWith(name))
  if (full >= 0) return { month: full + 1, thai: true }

  const consonants = clean.replace(/[^ก-ฮ]/g, '').replace(/(.)\1+/g, '$1')
  if (TH_CONSONANTS[consonants]) return { month: TH_CONSONANTS[consonants], thai: true }
  if (consonants === 'มค') return { month: /[ีิ]/.test(clean) ? 3 : 1, thai: true }
  if (consonants === 'มย') return clean.includes('เ') ? { month: 4, thai: true } : /[ิี]/.test(clean) ? { month: 6, thai: true } : null
  return null
}

export function findDate(lines: string[], today: string): string | null {
  const pattern = /(\d{1,2})\s*([A-Za-zก-๙.]{2,14}?)\s*(\d{4}|\d{2})(?!\d)/g
  for (const line of lines) {
    for (const m of line.matchAll(pattern)) {
      const found = findMonth(m[2])
      const day = Number(m[1])
      if (!found || day < 1 || day > 31) continue
      // Thai slips use the Buddhist year (2568, or just 68); English ones use 2025 / 25.
      let year = Number(m[3])
      if (m[3].length === 2) year += found.thai ? 2500 : 2000
      if (year >= 2400) year -= 543
      const d = new Date(Date.UTC(year, found.month - 1, day))
      if (d.getUTCMonth() !== found.month - 1) continue
      const iso = d.toISOString().slice(0, 10)
      if (year >= 2015 && iso <= today) return iso
    }
  }
  return null
}

export function findRecipient(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].match(TO_LABEL)
    if (!label) continue
    // Drop icon noise that OCR reads as stray symbols before the name.
    const words = lines[i].slice(label[0].length).replace(/^[\s:]+/, '').split(/\s+/)
    while (words.length && !/[A-Za-zก-๙]{3,}/.test(words[0])) words.shift()
    let name = words.join(' ')
    // Company names can wrap onto the next lines in capitals.
    for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
      if (!name || !/^[A-Z(][A-Z().,&\s-]+$/.test(lines[j])) break
      name += ' ' + lines[j]
    }
    if (name) return name.slice(0, 60)
  }
  return null
}

export function parseSlipText(text: string, today: string): SlipText {
  const lines = normalize(text).split('\n').map((l) => l.trim()).filter(Boolean)
  return { amount: findAmount(lines), date: findDate(lines, today), recipient: findRecipient(lines) }
}
