// Finds the amount, date and transaction reference in the text that OCR read from a slip.
// Pure logic: it looks for labels ("จำนวนเงิน", "Amount", ...) rather than fixed
// positions, so one reader covers every bank's layout.

export interface SlipText {
  amount: number | null
  date: string | null // YYYY-MM-DD
  memo: string | null // the note the sender typed on the slip, if any
  reference: string | null // printed transaction id, used to spot duplicates when there is no QR
}

const MONEY = /(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?!\d)/
const AMOUNT_LABEL = /จำนวน|amount|ยอดโอน|ยอดชำระ/i
const NOT_AMOUNT = /ค่า|ธรรมเนียม|fee|คงเหลือ|remaining|balance/i
// The memo field has a different name in each app. The first pattern tolerates OCR
// misreading the start of "บันทึกช่วยจำ" (it has been seen as "ปันทึกช่วยจำ").
const MEMO_LABEL = /^(.{0,8}ช่?วยจำ|บันทึก(?=\s*[:：]|\s*$)|โน้ต|หมายเหตุ|ข้อความ|memo|note|message)\s*[:：]?\s*(.*)$/i
// Lines that follow an empty memo and must not be mistaken for one.
const NOT_MEMO = /^(ผู้รับเงิน|สแกน|ตรวจสอบ|จำนวน|ค่าธรรมเนียม|ธรรมเนียม|หมายเลข|เลขที่|รหัส|ประเภท|ยอดเงิน|amount|fee|transaction|category|remaining|verified|total|location|detail)/i
const REF_LABEL = /transaction id|เลขที่รายการ|รหัสอ้างอิง|เลขที่อ้างอิง/i

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

export function findMemo(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].match(MEMO_LABEL)
    if (!label) continue
    // The memo is either on the label's line or on the line below it.
    const memo = label[2].trim() || (lines[i + 1] ?? '')
    if (memo && !NOT_MEMO.test(memo) && !MONEY.test(memo)) return memo.slice(0, 80)
  }
  return null
}

// Only trusts a reference that reads as one clean run of letters and digits,
// so a half-misread one never causes a false "already added".
export function findReference(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const label = lines[i].match(REF_LABEL)
    if (!label) continue
    const sameLine = lines[i].slice(label.index! + label[0].length)
    for (const candidate of [sameLine, lines[i + 1] ?? '']) {
      const m = candidate.match(/(?:^|[\s:])([A-Za-z0-9]{12,})(?=\s|$)/)
      if (m) return m[1]
    }
  }
  return null
}

export function parseSlipText(text: string, today: string): SlipText {
  const lines = normalize(text).split('\n').map((l) => l.trim()).filter(Boolean)
  return { amount: findAmount(lines), date: findDate(lines, today), memo: findMemo(lines), reference: findReference(lines) }
}
