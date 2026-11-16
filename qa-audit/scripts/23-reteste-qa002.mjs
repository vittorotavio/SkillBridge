// 1.5 — Reteste do QA-002 em duas variações independentes.
import { launch, newPage, settle, shotName, resetMock, APP } from './lib.mjs'
await resetMock()
const browser = await launch()
const casos = {
  'arquivo-da-tela-404 (pos-deploy)': async (page, context) => {
    await context.route(/\/assets\/Register(StudentMentor)?-.*\.js$/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html></html>' }))
    await page.getByRole('link', { name: /Criar conta/ }).first().click()
  },
  'rede-cai-durante-navegacao': async (page, context) => {
    await context.setOffline(true)
    await page.getByRole('link', { name: 'Entrar', exact: true }).first().click()
  },
}
for (const [nome, acao] of Object.entries(casos)) {
  const { context, page, events } = await newPage(browser, { viewport: { width: 1280, height: 800 } })
  await page.goto(APP)
  await settle(page)
  await acao(page, context)
  await page.waitForTimeout(3000)
  const root = await page.evaluate(() => document.getElementById('root')?.innerHTML.length)
  console.log(nome, '→ url', page.url().replace(APP, ''), '| #root chars:', root, '| erros:', events.pageErrors.map((e) => e.message.slice(0, 90)))
  await page.screenshot({ path: shotName('reteste', nome) })
  await context.close()
}
await browser.close()
