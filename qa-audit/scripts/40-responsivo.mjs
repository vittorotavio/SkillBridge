// 1.4-B — Responsividade: 320/375/414/768/1024/1366/1920 + zoom 200% (≈ 683px CSS a partir de 1366).
// Mede rolagem horizontal (e quem a causa), alvos de toque < 44px / < 24px no celular e o menu mobile.
import { launch, newPage, login, settle, shotName, saveJson, resetMock, APP, ROUTES } from './lib.mjs'

const widths = [320, 375, 414, 683, 768, 1024, 1366, 1920]
const groups = [
  { who: 'visitante', account: null, routes: [...ROUTES.public, '/sobre', '/precos', '/contato'] },
  { who: 'aluno', account: 'student', routes: ROUTES.student },
  { who: 'empresa', account: 'company', routes: ROUTES.company },
  { who: 'mentor', account: 'mentor', routes: ROUTES.mentor },
]
await resetMock()
const browser = await launch()
const overflow = []
const tapTargets = []
const menus = []
for (const g of groups) {
  const { context, page } = await newPage(browser, { viewport: { width: 1366, height: 800 } })
  if (g.account) await login(page, g.account)
  for (const route of g.routes) {
    for (const w of widths) {
      await page.setViewportSize({ width: w, height: w <= 414 ? 740 : 800 })
      await page.goto(`${APP}${route}`)
      await settle(page, 300)
      const info = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const extra = document.documentElement.scrollWidth - vw
        const culprits = []
        if (extra > 0) {
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect()
            if (r.right > vw + 1 && r.width > 0 && getComputedStyle(el).position !== 'fixed') {
              culprits.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 3).join('.')} [${(el.textContent || '').trim().slice(0, 40)}] right=${Math.round(r.right)}`)
            }
          }
        }
        return { extra, culprits: culprits.slice(-4) }
      })
      if (info.extra > 0) {
        overflow.push({ who: g.who, route, width: w, extraPx: info.extra, culprits: info.culprits })
        await page.screenshot({ path: shotName('resp', g.who, route, `${w}px`) })
      }
      if (w === 375) {
        const small = await page.evaluate(() => {
          const out = []
          for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role=button]')) {
            const r = el.getBoundingClientRect()
            const st = getComputedStyle(el)
            if (r.width === 0 || r.height === 0 || st.visibility === 'hidden') continue
            const min = Math.min(r.width, r.height)
            if (min < 44) out.push({ label: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), below24: min < 24 })
          }
          return out
        })
        tapTargets.push({ who: g.who, route, under44: small.length, under24: small.filter((s) => s.below24).length, examples: small.slice(0, 6) })
      }
    }
    // menu mobile
    await page.setViewportSize({ width: 375, height: 740 })
    await page.goto(`${APP}${route}`)
    await settle(page, 300)
    const btn = page.getByRole('button', { name: 'Abrir menu' })
    if (await btn.isVisible().catch(() => false)) {
      await btn.click()
      await page.waitForTimeout(400)
      const links = await page.locator('nav a:visible, header a:visible').count()
      menus.push({ who: g.who, route, abriu: true, linksVisiveis: links, ariaExpanded: await btn.getAttribute('aria-expanded').catch(() => null) })
      if (route === g.routes[0]) await page.screenshot({ path: shotName('resp', g.who, 'menu-mobile') })
    } else menus.push({ who: g.who, route, abriu: false })
  }
  await context.close()
}
await browser.close()
saveJson('40-responsivo.json', { overflow, tapTargets, menus })
console.log('ROLAGEM HORIZONTAL:')
for (const o of overflow) console.log(`  ${o.who} ${o.route} @${o.width}px +${o.extraPx}px  ← ${o.culprits.join(' | ').slice(0, 260)}`)
console.log('ALVOS DE TOQUE (375px):')
for (const t of tapTargets) console.log(`  ${t.who} ${t.route}: <44px=${t.under44} <24px=${t.under24}  ex: ${t.examples.map((e) => `${e.label}(${e.w}x${e.h})`).join(', ')}`)
console.log('MENU MOBILE:', JSON.stringify(menus.filter((m) => !m.abriu || !m.linksVisiveis)))
