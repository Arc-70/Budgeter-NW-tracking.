import { createWorker, type Worker } from 'tesseract.js'

// The OCR engine (Tesseract) runs inside the browser. Its files are served by
// this app from /tesseract (see scripts/copy-ocr-assets.mjs), so slip photos
// never leave the device.
const base = `${import.meta.env.BASE_URL}tesseract`

let worker: Promise<Worker> | null = null

function getWorker(): Promise<Worker> {
  worker ??= createWorker(['tha', 'eng'], 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    gzip: true,
  }).catch((err) => {
    worker = null // let the next scan retry
    throw err
  })
  return worker
}

export async function readText(image: HTMLCanvasElement): Promise<string> {
  const { data } = await (await getWorker()).recognize(image)
  return data.text
}
