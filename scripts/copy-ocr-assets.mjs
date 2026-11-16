// Copies the OCR engine and language files into public/ so the app serves them
// itself. Slip reading then runs fully on the device, with no third-party CDN.
import { cpSync, mkdirSync } from 'node:fs'

const out = 'public/tesseract'
mkdirSync(`${out}/core`, { recursive: true })
mkdirSync(`${out}/lang`, { recursive: true })

cpSync('node_modules/tesseract.js/dist/worker.min.js', `${out}/worker.min.js`)
for (const variant of ['', '-simd', '-relaxedsimd']) {
  const file = `tesseract-core${variant}-lstm.wasm.js`
  cpSync(`node_modules/tesseract.js-core/${file}`, `${out}/core/${file}`)
}
for (const lang of ['tha', 'eng']) {
  cpSync(`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${out}/lang/${lang}.traineddata.gz`)
}
console.log('OCR assets copied to', out)
