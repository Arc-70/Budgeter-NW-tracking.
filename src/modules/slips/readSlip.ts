import jsQR from 'jsqr'
import { bankFromText } from './banks'
import { readText } from './ocr'
import { parseSlipText } from './parseSlipText'
import { parseSlipQr } from './qr'

// What the scan screen shows for the user to confirm. Any field can be null
// when it could not be read.
export interface SlipDraft {
  amount: number | null
  date: string | null
  memo: string | null // the note written on the slip itself
  text: string // everything OCR read, used for keyword rules
  bank: string | null
  dedupeKey: string | null
}

// Small screenshots read much better when enlarged; huge photos are shrunk to keep it fast.
const TARGET_WIDTH = 1200
const RETRY_WIDTHS = [1600, 900, 2000]

function draw(image: ImageBitmap, width: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((image.height * width) / image.width)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}

function readQr(canvas: HTMLCanvasElement): string | null {
  const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null
}

export async function readSlip(file: Blob, today: string): Promise<SlipDraft> {
  // 'from-image' turns camera photos the right way up (iPhone photos are stored rotated).
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scaled = draw(image, image.width >= 1000 && image.width <= 1600 ? image.width : TARGET_WIDTH)

  // Step 1: the QR code gives the bank and a unique reference (never the amount).
  const qrText = readQr(scaled) ?? readQr(draw(image, image.width))
  const qr = qrText ? parseSlipQr(qrText, today) : null

  // Step 2: OCR reads the printed text for the amount, date and memo.
  let text = await readText(scaled)
  const fields = parseSlipText(text, today)

  // If something is still missing, try other sizes: OCR can succeed at one size and fail at another.
  for (const width of RETRY_WIDTHS) {
    if (fields.amount !== null && (fields.date !== null || qr?.dateHint)) break
    if (width === scaled.width) continue
    const retryText = await readText(draw(image, width))
    const retry = parseSlipText(retryText, today)
    fields.amount ??= retry.amount
    fields.date ??= retry.date
    fields.reference ??= retry.reference
    fields.memo ??= retry.memo
    text += '\n' + retryText
  }

  return {
    amount: fields.amount,
    // The date inside the QR is exact, so it wins over the OCR reading.
    date: qr?.dateHint ?? fields.date,
    memo: fields.memo,
    text,
    bank: qr?.bank ?? bankFromText(text),
    // No QR (TrueMoney payments, cropped slips): fall back to the printed transaction id.
    dedupeKey: qr?.dedupeKey ?? (fields.reference ? `TXT:${fields.reference}` : null),
  }
}
