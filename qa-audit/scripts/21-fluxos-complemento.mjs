// Complemento do 20: casos refeitos + falha ao baixar o pedaço (chunk) de uma tela.
import { launch, newPage, login, settle, shotName, saveJson, resetMock, configMock, APP, ACCOUNTS, PASSWORD } from './lib.mjs'

const out = {}
const browser = await launch()
async function caso(nome, fn) {
  await resetMock()
  const { context, page, events } = await newPage(browser, { viewport: { width: 1280, height: 800 } })
  try {
    out[nome] = await fn(page, context)
  } catch (e) {
    out[nome] = { erroDoTeste: String(e).slice(0, 300) }
  }
  out[nome].pageErrors = events.pageErrors.map((e) => e.message.slice(0, 200))
  await context.close()
  await configMock({})
  console.log(nome, JSON.stringify(out[nome]).slice(0, 500))
}

await caso('login-offline', async (page, context) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('E-mail').waitFor()
  await page.getByLabel('E-mail').fill(ACCOUNTS.student.email)
  await page.getByLabel('Senha').fill(PASSWORD)
  await context.setOffline(true)
  await page.getByRole('button', { name: /^Entrar como/ }).click()
  const erro = await page.locator('form p.text-red-600').textContent({ timeout: 20000 }).catch(() => null)
  await page.screenshot({ path: shotName('fluxo', 'login-offline') })
  return { erro }
})
await caso('login-email-com-espacos-e-maiusculas', async (page) => {
  await page.goto(`${APP}/login`)
  await page.getByLabel('E-mail').fill('  RAFAEL@QA.EXAMPLE.COM ')
  await page.getByLabel('Senha').fill(PASSWORD)
  await page.getByRole('button', { name: /^Entrar como/ }).click()
  await page.waitForTimeout(3000)
  return { url: page.url().replace(APP, '') }
})
await caso('certificado-inexistente', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/certificados/nao-existe`)
  await settle(page, 800)
  await page.screenshot({ path: shotName('fluxo', 'certificado-inexistente') })
  return { texto: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300) }
})
await caso('certificado-de-outro-aluno', async (page) => {
  // S2 (Marina) abrindo o certificado do S1 (Rafael): no mock a RLS não existe; aqui só vemos o que a TELA faz.
  await login(page, 'studentNoCompany')
  await page.goto(`${APP}/aluno/certificados/ce000000-0000-4000-8000-000000000001`)
  await settle(page, 800)
  await page.screenshot({ path: shotName('fluxo', 'certificado-de-outro-aluno') })
  return { texto: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300) }
})
await caso('f5-com-falha-500-ao-restaurar-conta', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/perfil`)
  await settle(page)
  await configMock({ failRest: 500, failPath: 'profiles' })
  await page.reload()
  await page.waitForTimeout(4000)
  await page.screenshot({ path: shotName('fluxo', 'f5-falha-restaurar-conta') })
  const url = page.url().replace(APP, '')
  const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)
  const sessaoSalva = await page.evaluate(() => Object.keys(localStorage).some((k) => k.includes('auth-token')))
  return { url, texto, sessaoContinuaSalvaNoNavegador: sessaoSalva }
})
await caso('chunk-da-tela-indisponivel', async (page, context) => {
  // Simula o que acontece depois de um novo deploy (arquivos antigos somem) ou com a rede caindo durante a navegação.
  await page.goto(APP)
  await settle(page)
  await context.route(/\/assets\/Login-.*\.js$/, (r) => r.fulfill({ status: 404, body: 'Not found' }))
  await page.getByRole('link', { name: 'Entrar', exact: true }).first().click()
  await page.waitForTimeout(2500)
  await page.screenshot({ path: shotName('fluxo', 'chunk-indisponivel') })
  return { url: page.url().replace(APP, ''), textoVisivel: (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200), htmlRoot: await page.evaluate(() => document.getElementById('root')?.innerHTML.length) }
})
await caso('vitrine-publica-offline', async (page, context) => {
  await context.route('http://127.0.0.1:54399/**', (r) => r.abort('internetdisconnected'))
  await page.goto(APP)
  await settle(page, 1500)
  await page.locator('text=Cursos em destaque').scrollIntoViewIfNeeded()
  await page.screenshot({ path: shotName('fluxo', 'vitrine-offline') })
  return { cardsDeCurso: await page.locator('a[href*="/aluno/cursos/"]').count() }
})

await browser.close()
saveJson('21-fluxos-complemento.json', out)
