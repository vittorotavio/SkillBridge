// Monta uma "prancha" com vários screenshots lado a lado (para revisar visualmente muitas telas).
//   node scripts/contact-sheet.mjs <saida.png> <largura-de-cada> <maxAltura> <img1> <img2> ...
import fs from 'node:fs'
import path from 'node:path'
import { launch, SHOTS } from './lib.mjs'

const [out, colWidth = '420', maxHeight = '1400', ...files] = process.argv.slice(2)
const cells = files
  .map((f) => (path.isAbsolute(f) ? f : path.join(SHOTS, f)))
  .map((f) => `<figure><figcaption>${path.basename(f)}</figcaption><div class="clip"><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"></div></figure>`)
  .join('')
const html = `<html><body style="margin:0;background:#888;font:12px sans-serif"><style>
figure{display:inline-block;vertical-align:top;margin:4px;background:#fff}
figcaption{padding:2px 4px;background:#222;color:#fff;width:${colWidth}px;overflow:hidden;white-space:nowrap}
.clip{width:${colWidth}px;max-height:${maxHeight}px;overflow:hidden}
img{width:${colWidth}px;display:block}</style>${cells}</body></html>`
const browser = await launch()
const page = await browser.newPage({ viewport: { width: (Number(colWidth) + 10) * files.length, height: 400 } })
await page.setContent(html)
await page.screenshot({ path: path.isAbsolute(out) ? out : path.join(SHOTS, out), fullPage: true })
await browser.close()
console.log('ok', out)
