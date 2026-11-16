// 1.3/1.4 — Percorre todas as telas (visitante, aluno, mentor, empresa) em desktop e celular:
// screenshot, erros de console/página, respostas 4xx/5xx e textos técnicos visíveis.
// Também garante que NENHUMA requisição sai para *.supabase.co (produção).
import { launch, newPage, login, settle, shotName, saveJson, findBadText, resetMock, APP, ROUTES } from './lib.mjs'

const viewports = { desktop: { width: 1366, height: 800 }, mobile: { width: 375, height: 740 } }
const plan = [
  { who: 'visitante', account: null, routes: ROUTES.public },
  { who: 'aluno', account: 'student', routes: ROUTES.student },
  { who: 'empresa', account: 'company', routes: ROUTES.company },
  { who: 'mentor', account: 'mentor', routes: ROUTES.mentor },
]

await resetMock()
const browser = await launch()
const results = []
const prodRequests = []
for (const [vpName, viewport] of Object.entries(viewports)) {
  for (const step of plan) {
    const { context, page, events } = await newPage(browser, { viewport })
    page.on('request', (r) => {
      if (/supabase\.co/.test(r.url())) prodRequests.push(r.url())
    })
    if (step.account) await login(page, step.account)
    for (const route of step.routes) {
      const before = { c: events.console.length, p: events.pageErrors.length, h: events.http4xx5xx.length }
      await page.goto(`${APP}${route}`)
      await settle(page, 600)
      const file = shotName(vpName, step.who, route === '/' ? 'home' : route)
      await page.screenshot({ path: file, fullPage: true })
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      results.push({
        viewport: vpName,
        who: step.who,
        route,
        finalUrl: page.url().replace(APP, ''),
        title: await page.title(),
        h1: await page.locator('h1').first().textContent({ timeout: 1000 }).catch(() => null),
        overflowX,
        badText: await findBadText(page),
        console: events.console.slice(before.c),
        pageErrors: events.pageErrors.slice(before.p),
        http: events.http4xx5xx.slice(before.h),
        screenshot: file.split(/[\\/]/).pop(),
      })
    }
    await context.close()
  }
}
await browser.close()
saveJson('10-smoke-telas.json', { prodRequests, results })
console.log(`telas: ${results.length} | requisições à produção: ${prodRequests.length}`)
for (const r of results) {
  const flags = [
    r.finalUrl !== r.route ? `→ ${r.finalUrl}` : '',
    r.overflowX > 0 ? `OVERFLOW-X ${r.overflowX}px` : '',
    r.badText.length ? `TEXTO: ${r.badText.map((b) => b.context).join(' | ')}` : '',
    r.console.length ? `CONSOLE(${r.console.length}): ${r.console.map((c) => c.text.slice(0, 120)).join(' || ')}` : '',
    r.pageErrors.length ? `PAGEERROR: ${r.pageErrors.map((e) => e.message).join(' | ')}` : '',
    r.http.length ? `HTTP: ${r.http.map((h) => `${h.status} ${h.method} ${h.url}`).join(' | ')}` : '',
  ].filter(Boolean)
  console.log(`${r.viewport.padEnd(7)} ${r.who.padEnd(9)} ${r.route.padEnd(60)} ${flags.join('  ')}`)
}
