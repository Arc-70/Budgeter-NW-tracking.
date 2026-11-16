import { describe, expect, it } from 'vitest'
import { bankFromText } from './banks'
import { findMonth, parseSlipText } from './parseSlipText'
import { parseSlipQr } from './qr'

const TODAY = '2026-11-16'

// The texts below are what the on-device reader actually produced from real
// slips, mistakes included, so the parser is tested against realistic input.

describe('parseSlipQr', () => {
  it('reads the bank and reference from real slip QR codes', () => {
    expect(parseSlipQr('00390006000001010300402180190651446487081705102TH9104BA78', TODAY)).toEqual({
      bank: 'Kasikorn (K PLUS / MAKE)', ref: '019065144648708170', dedupeKey: '004:019065144648708170', dateHint: null,
    })
    const bbl = parseSlipQr('004600060000010103002022520251128120748031959869AD5102TH9104E1F3', TODAY)!
    expect([bbl.bank, bbl.dateHint]).toEqual(['Bangkok Bank', '2025-11-28'])
    const scb = parseSlipQr('0046000600000101030140225202211022XMj8r6IIId6H8WNs5102TH91040F7E', TODAY)!
    expect([scb.bank, scb.ref, scb.dateHint]).toEqual(['SCB', '202211022XMj8r6IIId6H8WNs', '2022-11-02'])
  })

  it('reads the TrueMoney variant', () => {
    const field = (tag: string, value: string) => tag + String(value.length).padStart(2, '0') + value
    const inner = field('00', '01') + field('01', '01') + field('02', 'P2P') + field('03', '50001234567890') + field('04', '25012024')
    const tmn = parseSlipQr(field('00', inner) + field('91', 'abcd'), TODAY)!
    expect(tmn).toEqual({ bank: 'TrueMoney', ref: '50001234567890', dedupeKey: 'TMN:50001234567890', dateHint: '2024-01-25' })
  })

  it('rejects QR codes that are not slips', () => {
    expect(parseSlipQr('https://example.com', TODAY)).toBeNull()
    expect(parseSlipQr('00020101021129370016A000000677010111011300668123456785802TH6304ABCD', TODAY)).toBeNull()
  })
})

describe('parseSlipText', () => {
  it('reads a K PLUS slip in English', () => {
    const text = `Transfer Completed\n6Mar 19 2:46 PM\nMR. Kasikorn R\nKBank\nMR. Testsam Kasikorn\nTransaction ID:\n019065144648708170 [MITE HEE]\nAmount:                            [bags\n5,000.00 Baht รู่\n0.00 Baht Verified by K+\nRemaining ชิล1.: 789,281.03 Baht\nBack               Share\nto Banking                      Favorite       Schedule`
    expect(parseSlipText(text, TODAY)).toEqual({ amount: 5000, date: '2019-03-06', reference: '019065144648708170' })
  })

  it('reads a K PLUS slip in Thai with a Buddhist year', () => {
    const text = `โอนเงินสําเร็จ\n18 ส.ุค. 61 8:55 น.\nธ.กสิกรไทย\nเลขที่รายการ:\n123456789012345678\nจํานวน:\n50,000.00 บาท\nค่าธรรมเนียม:\n0.00 บาท verified by K+\nยอดเงินคงเหลือ: 83,888.00 บาท`
    expect(parseSlipText(text, TODAY)).toEqual({ amount: 50000, date: '2018-08-18', reference: '123456789012345678' })
  })

  it('reads a Bangkok Bank slip', () => {
    const text = `Q Bangkok Bank\nรายการสําเร็จ\n28 พ.ุย. 68,12:07\nจํานวนเงิน\n393.00 ากร\nจาก        (0)\nธนาคารกรุงเทพ\nไปที่        2 SHOPEEPAY\n(THAILAND)\nCO.,LTD\nBiller\nค่า           0.00 THB\nธรรมเนียม`
    expect(parseSlipText(text, TODAY)).toEqual({ amount: 393, date: '2025-11-28', reference: null })
  })

  it('reads an SCB slip', () => {
    const text = `@ โอนเงินสําเร็จ\n02 พพ.ย. 2565 - 11:34\nจาก                 @ นางสาว สุวภัทร ดอกแย้ม\nXXX-XXX721-6\nไปยัง                          @ นาย ธนากร ขวัญพูล\n%-1047\nจํานวนเงิน                                                           1,000.00`
    expect(parseSlipText(text, TODAY)).toEqual({ amount: 1000, date: '2022-11-02', reference: null })
  })

  it('ignores a reference that was only partly readable', () => {
    expect(parseSlipText('รหัสอ้างอิง: 2022110227(ผ086!แส่6พธหมงร', TODAY).reference).toBeNull()
  })

  it('never mistakes the fee or remaining balance for the amount', () => {
    expect(parseSlipText('Fee: 10.00\nRemaining 900.00\nPaid 250.00 Baht', TODAY).amount).toBe(250)
  })

  it('gives up on a date it cannot read instead of guessing', () => {
    expect(parseSlipText('184d.n. 61 8:55\n9:41 AM 1009', TODAY).date).toBeNull()
    expect(parseSlipText('30 ก.พ. 68', TODAY).date).toBeNull() // 30 February
  })
})

describe('findMonth', () => {
  it('tells apart the Thai months that look alike', () => {
    expect(findMonth('ม.ค.')?.month).toBe(1)
    expect(findMonth('มี.ค.')?.month).toBe(3)
    expect(findMonth('เม.ย.')?.month).toBe(4)
    expect(findMonth('มิ.ย.')?.month).toBe(6)
    expect(findMonth('พฤศจิกายน')?.month).toBe(11)
    expect(findMonth('AM')).toBeNull()
  })
})

describe('bankFromText', () => {
  it('spots the app name when there is no QR', () => {
    expect(bankFromText('0.00 บาท verified by K+')).toBe('Kasikorn (K PLUS / MAKE)')
    expect(bankFromText('TrueMoney Wallet')).toBe('TrueMoney')
    expect(bankFromText('hello')).toBeNull()
  })
})
