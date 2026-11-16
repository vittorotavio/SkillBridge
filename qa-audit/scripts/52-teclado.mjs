// 1.4-H — Uso só com teclado: ordem do Tab, foco visível, modal (Esc, foco preso, foco devolvido), menus.
import { launch, newPage, login, settle, shotName, saveJson, resetMock, APP, PASSWORD, ACCOUNTS } from './lib.mjs'

const out = {}
await resetMock()
const browser = await launch()

/** Dá N Tabs e registra o elemento focado + se há indicação visual de foco (outline ou box-shadow/ring). */
async function tabWalk(page, n) {
  const steps = []
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab')
    steps.push(
      await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return { el: 'body' }
        const st = getComputedStyle(el)
        const visible = (st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0) || (st.boxShadow && st.boxShadow !== 'none')
        const inDialog = !!el.closest('[role=dialog]')
        return { el: `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 28)}"`, focoVisivel: visible, inDialog }
      })
    )
  }
  return steps
}

{
  const { context, page } = await newPage(browser, { viewport: { width: 1366, height: 800 } })
  await page.goto(APP)
  await settle(page)
  const steps = await tabWalk(page, 12)
  out.landing = { primeiro: steps[0], temPularParaConteudo: /pular|skip/i.test(steps[0].el), semFocoVisivel: steps.filter((s) => s.focoVisivel === false).map((s) => s.el) }
  await page.screenshot({ path: shotName('teclado', 'landing-foco') })

  await page.goto(`${APP}/login`)
  await settle(page)
  const loginSteps = await tabWalk(page, 12)
  out.login = { ordem: loginSteps.map((s) => s.el), semFocoVisivel: loginSteps.filter((s) => s.focoVisivel === false).map((s) => s.el) }
  // abas de tipo de conta: o leitor de tela sabe qual está selecionada?
  out.login.abasTemEstado = await page.locator('button:has-text("Mentor")').first().evaluate((b) => b.hasAttribute('aria-pressed') || b.getAttribute('role') === 'tab')
  out.login.erroAnunciado = null
  await page.getByLabel('E-mail').fill(ACCOUNTS.student.email)
  await page.getByLabel('Senha').fill('errada')
  await page.getByLabel('Senha').press('Enter')
  await page.locator('form p.text-red-600').waitFor()
  out.login.erroAnunciado = await page.locator('form p.text-red-600').evaluate((p) => p.getAttribute('role') || p.getAttribute('aria-live') || p.closest('[aria-live]')?.getAttribute('aria-live') || null)
  out.login.campoMarcadoInvalido = await page.getByLabel('Senha').getAttribute('aria-invalid')
  await context.close()
}

{
  const { context, page } = await newPage(browser, { viewport: { width: 1366, height: 800 } })
  await login(page, 'student')
  await page.goto(`${APP}/aluno/perfil`)
  await settle(page)
  const steps = await tabWalk(page, 6)
  out.painel = { primeiros: steps.map((s) => s.el), semFocoVisivel: steps.filter((s) => s.focoVisivel === false).map((s) => s.el) }
  // abre o modal pelo teclado
  const btn = page.getByRole('button', { name: 'Editar perfil' })
  await btn.focus()
  await page.keyboard.press('Enter')
  await page.getByRole('dialog').waitFor()
  const dlgSteps = await tabWalk(page, 8)
  out.modal = { focoSaiuDoModal: dlgSteps.some((s) => s.inDialog === false), passos: dlgSteps.map((s) => `${s.inDialog ? 'DENTRO' : 'FORA'} ${s.el}`) }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  out.modal.fechouComEsc = !(await page.getByRole('dialog').isVisible().catch(() => false))
  out.modal.focoDepoisDeFechar = await page.evaluate(() => `${document.activeElement?.tagName} "${(document.activeElement?.textContent || '').trim().slice(0, 30)}"`)
  // menu da conta
  const conta = page.getByRole('button', { name: 'Menu da conta' })
  await conta.focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  out.menuConta = { abriu: await page.getByText('Sair').isVisible() }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  out.menuConta.fechouComEsc = !(await page.getByText('Sair').isVisible())
  // player: dá para concluir a aula só com teclado?
  await page.goto(`${APP}/aluno/cursos/k0000000-0000-4000-8000-000000000001/aulas?aula=0-1`)
  await settle(page)
  const playerSteps = await tabWalk(page, 25)
  out.player = { alcancaConcluir: playerSteps.some((s) => /Concluir/.test(s.el)) }
  await context.close()
}

await browser.close()
saveJson('52-teclado.json', out)
console.log(JSON.stringify(out, null, 1))
