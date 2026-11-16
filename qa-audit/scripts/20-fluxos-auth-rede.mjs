// 1.3 / 1.4-D / 1.4-E — Autenticação, rotas, IDs inexistentes, duplo clique, rede lenta/offline/erro/sem resposta.
// Cada caso grava screenshot e o texto que o usuário vê. Saída: logs/20-fluxos-auth-rede.json
import { launch, newPage, login, settle, shotName, saveJson, resetMock, configMock, mockLog, clearMockLog, APP, APP_NOENV, ACCOUNTS, PASSWORD } from './lib.mjs'

const out = {}
const browser = await launch()
const visibleText = (page, sel = 'main, body') => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, ' ').slice(0, 400))
const loginError = (page) => page.locator('form p.text-red-600').textContent({ timeout: 20000 }).catch(() => null)

async function caso(nome, fn) {
  await resetMock()
  const { context, page, events } = await newPage(browser, { viewport: { width: 1280, height: 800 } })
  const started = Date.now()
  try {
    out[nome] = { ...(await fn(page, context)), ms: Date.now() - started }
  } catch (e) {
    out[nome] = { erroDoTeste: String(e).slice(0, 300) }
  }
  out[nome].pageErrors = events.pageErrors
  out[nome].console = events.console.filter((c) => !/WebSocket|realtime/i.test(c.text)).map((c) => c.text.slice(0, 200))
  await page.screenshot({ path: shotName('fluxo', nome) }).catch(() => {})
  await context.close()
  await configMock({})
  console.log(nome, JSON.stringify(out[nome]).slice(0, 400))
}

// --- ambiente sem variáveis
await caso('sem-env', async (page) => {
  await page.goto(APP_NOENV)
  await page.waitForTimeout(1500)
  return { textoVisivel: await page.evaluate(() => document.body.innerText.slice(0, 300)), htmlRoot: await page.evaluate(() => document.getElementById('root')?.innerHTML.length) }
})

// --- login
await caso('login-senha-errada', async (page) => {
  await login(page, { ...ACCOUNTS.student, password: 'errada123' }, { waitHome: false })
  return { erro: await loginError(page) }
})
await caso('login-aba-errada', async (page) => {
  await login(page, { ...ACCOUNTS.mentor, tab: 'Aluno' }, { waitHome: false })
  return { erro: await loginError(page), url: page.url() }
})
await caso('login-offline', async (page, context) => {
  await page.goto(`${APP}/login`)
  await context.setOffline(true)
  await page.getByLabel('E-mail').fill(ACCOUNTS.student.email)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: /^Entrar como/ }).click()
  const erro = await loginError(page)
  await context.setOffline(false)
  return { erro }
})
await caso('login-servidor-500', async (page) => {
  await configMock({ failAuth: 500 })
  await login(page, ACCOUNTS.student, { waitHome: false })
  return { erro: await loginError(page) }
})
await caso('login-servidor-sem-resposta', async (page) => {
  await configMock({ hang: true, failPath: '^/auth/' })
  await login(page, ACCOUNTS.student, { waitHome: false })
  await page.waitForTimeout(25000)
  return { botaoApos25s: await page.getByRole('button', { name: /Entr/ }).last().textContent(), erro: await page.locator('form p.text-red-600').textContent({ timeout: 500 }).catch(() => null) }
})
await caso('login-duplo-clique', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('E-mail').fill(ACCOUNTS.student.email)
  await page.getByLabel('Senha').fill(PASSWORD)
  await clearMockLog()
  await configMock({ delayMs: 800 })
  const btn = page.getByRole('button', { name: /^Entrar como/ })
  await btn.dblclick()
  await page.waitForURL(/\/aluno/, { timeout: 15000 })
  const log = await mockLog()
  return { chamadasToken: log.filter((l) => l.path === '/auth/v1/token').length }
})
await caso('login-enter-envia', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('E-mail').fill(ACCOUNTS.student.email)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByLabel('Senha').press('Enter')
  await page.waitForURL(/\/aluno/, { timeout: 15000 }).catch(() => {})
  return { url: page.url() }
})
await caso('login-email-com-espacos-e-maiusculas', async (page) => {
  await login(page, { ...ACCOUNTS.student, email: '  RAFAEL@QA.EXAMPLE.COM ' }, { waitHome: false })
  await page.waitForTimeout(2500)
  return { url: page.url(), erro: await page.locator('form p.text-red-600').textContent({ timeout: 500 }).catch(() => null), validacaoNativa: await page.getByLabel('E-mail').evaluate((el) => el.validationMessage) }
})

// --- rotas
await caso('rota-protegida-sem-login-e-volta', async (page) => {
  await page.goto(`${APP}/aluno/vagas`)
  await settle(page)
  const redirecionou = page.url()
  await page.getByLabel('E-mail').fill(ACCOUNTS.student.email)
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: /^Entrar como/ }).click()
  await page.waitForURL(/\/aluno/, { timeout: 15000 })
  await settle(page)
  return { redirecionou, depoisDoLogin: page.url() }
})
await caso('rota-de-outro-perfil', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/empresa/configuracoes`)
  await settle(page)
  return { url: page.url() }
})
await caso('rota-inexistente', async (page) => {
  await page.goto(`${APP}/pagina-que-nao-existe`)
  await settle(page)
  return { url: page.url(), h1: await page.locator('h1').first().textContent() }
})
await caso('rota-inexistente-logado', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/xyz`)
  await settle(page)
  return { url: page.url(), h1: await page.locator('h1').first().textContent() }
})
for (const [nome, rota] of Object.entries({
  'id-curso-inexistente': '/aluno/cursos/nao-existe',
  'id-aulas-inexistente': '/aluno/cursos/nao-existe/aulas',
  'id-aula-fora-do-intervalo': '/aluno/cursos/k0000000-0000-4000-8000-000000000001/aulas?aula=99-99',
  'id-aula-lixo': '/aluno/cursos/k0000000-0000-4000-8000-000000000001/aulas?aula=abc',
  'id-certificado-inexistente': '/aluno/certificados/nao-existe',
  'curso-de-outra-empresa': '/aluno/cursos/k0000000-0000-4000-8000-000000000006',
  'aulas-curso-outra-empresa': '/aluno/cursos/k0000000-0000-4000-8000-000000000006/aulas',
  'aulas-curso-nao-matriculado': '/aluno/cursos/k0000000-0000-4000-8000-000000000003/aulas',
  'curso-rascunho': '/aluno/cursos/k0000000-0000-4000-8000-000000000004',
  'duvidas-mentor-inexistente': '/aluno/duvidas?with=nao-existe',
})) {
  await caso(nome, async (page) => {
    await login(page, 'student')
    await page.goto(`${APP}${rota}`)
    await settle(page, 800)
    return { url: page.url().replace(APP, ''), texto: await visibleText(page, 'main') }
  })
}

// --- sessão / logout / abas
await caso('logout-e-voltar', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/perfil`)
  await settle(page)
  await page.locator('header button').last().click()
  const sair = page.getByRole('button', { name: /Sair/ }).or(page.getByRole('menuitem', { name: /Sair/ }))
  await sair.first().click()
  await settle(page)
  const aposSair = page.url()
  await page.goBack()
  await settle(page)
  return { aposSair, aposVoltar: page.url(), storage: await page.evaluate(() => Object.keys(localStorage)) }
})
await caso('duas-abas-logout', async (page, context) => {
  await login(page, 'student')
  const outra = await context.newPage()
  await outra.goto(`${APP}/aluno/cursos`)
  await settle(outra)
  const antes = outra.url()
  await page.locator('header button').last().click()
  await page.getByRole('button', { name: /Sair/ }).or(page.getByRole('menuitem', { name: /Sair/ })).first().click()
  await settle(page)
  await outra.waitForTimeout(1500)
  return { antes, outraAbaDepois: outra.url() }
})
await caso('f5-com-falha-ao-restaurar-conta', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/perfil`)
  await settle(page)
  await configMock({ failRest: 503, failPath: 'profiles' })
  await page.reload()
  await settle(page, 1500)
  const url = page.url()
  const temSessaoSalva = await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('auth-token')))
  await configMock({})
  await page.reload()
  await settle(page, 1500)
  return { urlComFalha: url.replace(APP, ''), sessaoContinuaSalva: temSessaoSalva, urlDepoisQueServidorVolta: page.url().replace(APP, '') }
})
await caso('painel-carga-com-erro-500', async (page) => {
  await login(page, 'student')
  await configMock({ failRest: 500, failPath: 'courses' })
  await page.reload()
  await settle(page, 1500)
  const texto = await visibleText(page)
  await configMock({})
  const botao = page.getByRole('button', { name: 'Tentar novamente' })
  const temBotao = await botao.isVisible().catch(() => false)
  if (temBotao) await botao.click()
  await settle(page, 1000)
  return { texto, temBotao, depoisDeTentar: page.url().replace(APP, ''), h1: await page.locator('h1').first().textContent().catch(() => null) }
})
await caso('painel-carga-sem-resposta', async (page) => {
  await login(page, 'student')
  await configMock({ hang: true, failPath: 'jobs' })
  await page.reload()
  await page.waitForTimeout(20000)
  return { texto: await visibleText(page), spinner: await page.locator('[role=status]').count() }
})
await caso('vitrine-publica-offline', async (page, context) => {
  await context.route('http://127.0.0.1:54399/**', (r) => r.abort('internetdisconnected'))
  await page.goto(APP)
  await settle(page, 1500)
  return { texto: await page.locator('section').nth(1).innerText().then((t) => t.slice(0, 300)).catch(() => null) }
})
await caso('vitrine-publica-3g', async (page, context) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 })
  const t0 = Date.now()
  await page.goto(APP, { waitUntil: 'domcontentloaded' })
  await page.screenshot({ path: shotName('fluxo', 'vitrine-3g-inicio') })
  await page.locator('h1').first().waitFor({ timeout: 60000 })
  const h1ms = Date.now() - t0
  await page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {})
  return { msAteTitulo: h1ms, msAteRedeOciosa: Date.now() - t0 }
})

await browser.close()
saveJson('20-fluxos-auth-rede.json', out)
