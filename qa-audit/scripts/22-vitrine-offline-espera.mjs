// Repete o caso "vitrine sem conexão" esperando 20 s (o postgrest-js pode tentar de novo antes de desistir).
import { launch, newPage, shotName, resetMock, APP } from './lib.mjs'
await resetMock()
const browser = await launch()
const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 800 } })
await context.route('http://127.0.0.1:54399/**', (r) => r.abort('internetdisconnected'))
await page.goto(APP)
for (const s of [2, 5, 10, 20]) {
  await page.waitForTimeout(s === 2 ? 2000 : (s - [2, 5, 10, 20][[2, 5, 10, 20].indexOf(s) - 1]) * 1000)
  const t = await page.locator('#cursos, section').nth(1).innerText().catch(() => '')
  console.log(`${s}s:`, t.replace(/\s+/g, ' ').slice(0, 160))
}
await page.locator('text=Cursos em destaque').scrollIntoViewIfNeeded()
await page.screenshot({ path: shotName('fluxo', 'vitrine-offline-20s') })
await browser.close()
