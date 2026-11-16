// Verifica a faixa clara na borda direita vista nos screenshots do tema escuro.
import { launch, newPage, login, settle, shotName, resetMock, APP } from './lib.mjs'

await resetMock()
const browser = await launch()
const { context, page } = await newPage(browser, { viewport: { width: 1366, height: 800 }, colorScheme: 'dark' })
await context.addInitScript(() => localStorage.setItem('skillbridge-theme', 'dark'))
await login(page, 'student')
for (const route of ['/aluno', '/empresa/cursos', '/aluno/cursos']) {
  await page.goto(`${APP}${route}`)
  await settle(page, 500)
  const info = await page.evaluate(() => {
    const cs = (el) => getComputedStyle(el).backgroundColor
    const vw = document.documentElement.clientWidth
    const el = document.elementFromPoint(vw - 3, 400)
    return { htmlBg: cs(document.documentElement), bodyBg: cs(document.body), scrollW: document.documentElement.scrollWidth, clientW: vw, innerW: window.innerWidth, elementoNaBordaDireita: el ? `${el.tagName}.${String(el.className).slice(0, 80)} bg=${cs(el)}` : null }
  })
  console.log(route, JSON.stringify(info))
}
await page.screenshot({ path: shotName('dark', 'borda-direita-viewport') })
await browser.close()
