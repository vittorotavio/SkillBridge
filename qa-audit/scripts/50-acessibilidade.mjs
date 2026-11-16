// 1.4-A / 1.4-H — axe-core (WCAG 2.0/2.1/2.2 A+AA) em todas as telas, tema claro e escuro.
// O contraste é medido pela regra color-contrast do axe (cálculo real das cores renderizadas).
import AxeBuilder from '@axe-core/playwright'
import { launch, newPage, login, settle, shotName, saveJson, resetMock, APP, ROUTES } from './lib.mjs'

const groups = [
  { who: 'visitante', account: null, routes: [...ROUTES.public, '/sobre', '/contato', '/precos'] },
  { who: 'aluno', account: 'student', routes: ROUTES.student },
  { who: 'empresa', account: 'company', routes: ROUTES.company },
  { who: 'mentor', account: 'mentor', routes: ROUTES.mentor },
]
await resetMock()
const browser = await launch()
const results = []
for (const theme of ['light', 'dark']) {
  for (const g of groups) {
    const { context, page } = await newPage(browser, { viewport: { width: 1366, height: 800 }, colorScheme: theme })
    await context.addInitScript((t) => localStorage.setItem('skillbridge-theme', t), theme)
    if (g.account) await login(page, g.account)
    for (const route of g.routes) {
      await page.goto(`${APP}${route}`)
      await settle(page, 500)
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const violations = r.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        count: v.nodes.length,
        nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 160), summary: (n.failureSummary || '').replace(/\s+/g, ' ').slice(0, 220) })),
      }))
      results.push({ theme, who: g.who, route, violations })
      if (theme === 'dark' && ['/', '/login', ROUTES.student[0], ROUTES.company[0], ROUTES.mentor[0], '/aluno/mentoria', '/empresa/cursos'].includes(route)) {
        await page.screenshot({ path: shotName('dark', g.who, route === '/' ? 'home' : route), fullPage: true })
      }
    }
    await context.close()
  }
}
await browser.close()
saveJson('50-axe.json', results)
// resumo por regra
const byRule = {}
for (const r of results) for (const v of r.violations) {
  const k = `${v.id} (${v.impact})`
  byRule[k] ??= { telas: new Set(), nos: 0, help: v.help, exemplos: [] }
  byRule[k].telas.add(`${r.theme}:${r.route}`)
  byRule[k].nos += v.count
  if (byRule[k].exemplos.length < 6) byRule[k].exemplos.push(`[${r.theme} ${r.route}] ${v.nodes[0]?.target} :: ${v.nodes[0]?.summary}`)
}
for (const [k, v] of Object.entries(byRule)) {
  console.log(`\n${k} — ${v.help} — ${v.telas.size} tela(s)/tema, ${v.nos} elementos`)
  for (const e of v.exemplos) console.log('   ', e.slice(0, 330))
}
console.log('\ntelas sem violação:', results.filter((r) => r.violations.length === 0).length, '/', results.length)
