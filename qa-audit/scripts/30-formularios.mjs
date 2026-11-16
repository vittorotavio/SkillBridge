// 1.4-C / 1.4-D — Formulários com entradas ruins e cliques duplos em ações que gravam.
// "chamadas" = quantas requisições de escrita chegaram ao Supabase falso (mede envio duplicado).
import { launch, newPage, login, settle, shotName, saveJson, resetMock, configMock, mockLog, clearMockLog, mock, APP, PASSWORD } from './lib.mjs'

const out = {}
const browser = await launch()
const LONG = 'A'.repeat(5000)
const XSS = '<script>alert(1)</script><img src=x onerror=alert(2)>'
const SQL = "' OR 1=1 --"
const EMOJI = 'Ção Ñandú 😀🚀 ação'

async function caso(nome, fn, viewport = { width: 1280, height: 900 }) {
  await resetMock()
  const { context, page, events } = await newPage(browser, { viewport })
  try {
    out[nome] = await fn(page, context)
  } catch (e) {
    out[nome] = { erroDoTeste: String(e).split('\n')[0].slice(0, 250) }
  }
  out[nome].dialogs = events.dialogs
  out[nome].pageErrors = events.pageErrors.map((e) => e.message.slice(0, 150))
  await page.screenshot({ path: shotName('form', nome), fullPage: false }).catch(() => {})
  await context.close()
  await configMock({})
  console.log(nome, JSON.stringify(out[nome]).slice(0, 450))
}
const writes = async (re) => (await mockLog()).filter((l) => l.method !== 'GET' && re.test(l.path)).length
const nativeMsg = (loc) => loc.evaluate((el) => el.validationMessage)
const shownError = (page) => page.locator('p.text-red-600, span.text-red-600, p.text-red-500, span.text-red-500, .bg-red-50').allInnerTexts().then((t) => t.join(' | '))

// ------------------------------------------------------------------ cadastro aluno/mentor
async function fillRegister(page, { name, email, password }) {
  await page.goto(`${APP}/cadastro`)
  await page.getByLabel('Nome completo').fill(name)
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
}
const submitRegister = (page) => page.getByRole('button', { name: /^Criar conta como/ })

await caso('cadastro-nome-so-espacos', async (page) => {
  await fillRegister(page, { name: '     ', email: 'novo1@qa.example.com', password: 'senha123' })
  await submitRegister(page).click()
  await page.waitForTimeout(600)
  return { erro: await shownError(page) }
})
await caso('cadastro-email-invalido', async (page) => {
  await fillRegister(page, { name: 'Fulano', email: 'abc@', password: 'senha123' })
  await submitRegister(page).click()
  return { mensagemNativa: await nativeMsg(page.getByLabel('E-mail')) }
})
await caso('cadastro-senha-curta', async (page) => {
  await fillRegister(page, { name: 'Fulano', email: 'novo2@qa.example.com', password: '12345' })
  await submitRegister(page).click()
  return { mensagemNativa: await nativeMsg(page.getByLabel('Senha')) }
})
await caso('cadastro-senha-fraca-123456', async (page) => {
  await fillRegister(page, { name: 'Fulano', email: 'novo3@qa.example.com', password: '123456' })
  await submitRegister(page).click()
  await page.waitForTimeout(1200)
  return { aceitou: await page.getByText('Confirme seu e-mail').isVisible() }
})
await caso('cadastro-email-ja-existe', async (page) => {
  await fillRegister(page, { name: 'Rafael', email: 'rafael@qa.example.com', password: 'senha123' })
  await submitRegister(page).click()
  await page.waitForTimeout(1200)
  return { erro: await shownError(page) }
})
await caso('cadastro-nome-5000-xss-emoji', async (page) => {
  await fillRegister(page, { name: `${EMOJI} ${XSS} ${LONG}`, email: 'longo2@qa.example.com', password: 'senha123' })
  await submitRegister(page).click()
  await page.waitForTimeout(1500)
  const aceitou = await page.getByText('Confirme seu e-mail').isVisible()
  // confirma o e-mail no mock e entra: o nome aparece escapado? a interface quebra?
  await mock('/__qa/confirm?email=longo2@qa.example.com', {})
  await page.goto(`${APP}/login`)
  await page.getByLabel('E-mail').fill('longo2@qa.example.com')
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: /^Entrar como/ }).click()
  await page.waitForURL(/\/aluno/, { timeout: 15000 }).catch(() => {})
  await settle(page, 800)
  await page.screenshot({ path: shotName('form', 'nome-5000-painel'), fullPage: false })
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  return { aceitou, url: page.url().replace(APP, ''), overflowX, nomeGravado: ((await mock('/__qa/state?table=students')).find((s) => s.email === 'longo2@qa.example.com')?.name ?? '').length }
})
await caso('cadastro-duplo-clique', async (page) => {
  await fillRegister(page, { name: 'Duplo Clique', email: 'duplo@qa.example.com', password: 'senha123' })
  await clearMockLog()
  await configMock({ delayMs: 700 })
  await submitRegister(page).dblclick()
  await page.waitForTimeout(2500)
  return { chamadasSignup: await writes(/\/auth\/v1\/signup/) }
})
await caso('cadastro-mentor-por-link-de-convite', async (page) => {
  await page.goto(`${APP}/cadastro?tipo=mentor&email=convidada@qa.example.com&nome=${encodeURIComponent('<b>Convidada</b>')}`)
  return { nome: await page.getByLabel('Nome completo').inputValue(), email: await page.getByLabel('E-mail').inputValue(), abaMentor: await page.getByRole('button', { name: /^Criar conta como Mentor/ }).isVisible() }
})

// ------------------------------------------------------------------ cadastro empresa
async function fillCompany(page, cnpj) {
  await page.goto(`${APP}/cadastro/empresa`)
  await page.getByLabel('CNPJ').fill(cnpj)
  await page.getByLabel('Razão social').fill('Empresa Teste QA Ltda')
  await page.getByLabel('Nome fantasia').fill('Empresa Teste QA')
  await page.getByLabel('Seu nome').fill('Responsável QA')
  await page.getByLabel('E-mail corporativo').fill(`emp${Date.now()}@qa.example.com`)
  await page.getByLabel('Senha de acesso').fill('senha123')
}
await caso('empresa-cnpj-letras', async (page) => {
  await fillCompany(page, 'abc.def/ghij-kl')
  const valor = await page.getByLabel('CNPJ').inputValue()
  await page.getByRole('button', { name: 'Criar conta da empresa' }).click()
  await page.waitForTimeout(500)
  return { valorNoCampo: valor, erro: await shownError(page), nativa: await nativeMsg(page.getByLabel('CNPJ')) }
})
await caso('empresa-cnpj-digito-errado', async (page) => {
  await fillCompany(page, '11222333000182')
  await page.getByRole('button', { name: 'Criar conta da empresa' }).click()
  await page.waitForTimeout(500)
  return { valorNoCampo: await page.getByLabel('CNPJ').inputValue(), erro: await shownError(page) }
})
await caso('empresa-cnpj-ja-cadastrado', async (page) => {
  await fillCompany(page, '11222333000181') // CNPJ da TechNova QA
  const email = await page.getByLabel('E-mail corporativo').inputValue()
  await page.getByRole('button', { name: 'Criar conta da empresa' }).click()
  await page.waitForTimeout(1500)
  const telaConfirmacao = await page.getByText('Confirme seu e-mail').isVisible()
  await mock(`/__qa/confirm?email=${email}`, {})
  await page.goto(`${APP}/login`)
  await page.getByRole('button', { name: 'Empresa', exact: true }).click()
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill('senha123')
  await page.getByRole('button', { name: /^Entrar como/ }).click()
  await page.waitForTimeout(2500)
  return { telaConfirmacao, erroNoLogin: await shownError(page), url: page.url().replace(APP, '') }
})

// ------------------------------------------------------------------ aluno
await caso('aluno-perfil-nome-3-espacos', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/perfil`)
  await page.getByRole('button', { name: 'Editar perfil' }).click()
  await page.getByLabel('Nome completo').fill('   ')
  await clearMockLog()
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await page.waitForTimeout(800)
  return { nativa: await nativeMsg(page.getByLabel('Nome completo')).catch(() => null), erro: await shownError(page), gravacoes: await writes(/students/) }
})
await caso('aluno-matricula-duplo-clique', async (page) => {
  await login(page, 'studentNoCompany')
  await page.goto(`${APP}/aluno/cursos/k0000000-0000-4000-8000-000000000001`)
  await clearMockLog()
  await configMock({ delayMs: 700 })
  await page.getByRole('button', { name: /Matricular/ }).dblclick()
  await page.waitForTimeout(3000)
  return { chamadasRpc: await writes(/enroll_in_course/) }
})
await caso('aluno-concluir-aula-duplo-clique', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/cursos/k0000000-0000-4000-8000-000000000001/aulas?aula=0-1`)
  await settle(page)
  await clearMockLog()
  await configMock({ delayMs: 700 })
  await page.getByRole('button', { name: /Concluir/ }).dblclick()
  await page.waitForTimeout(3000)
  return { chamadasRpc: await writes(/complete_lesson/), urlDepois: page.url().replace(APP, '') }
})
await caso('aluno-candidatura-duplo-clique', async (page) => {
  await resetMock()
  await login(page, 'student')
  // remove a candidatura existente para poder candidatar de novo
  await page.goto(`${APP}/aluno/vagas`)
  await settle(page)
  const botoes = await page.getByRole('button', { name: /Candidatar/ }).count()
  const estadoEncerrada = await page.getByRole('button', { name: /Candidatar/ }).last().isDisabled().catch(() => null)
  return { botoesCandidatar: botoes, botaoDaVagaEncerradaDesabilitado: estadoEncerrada }
})
await caso('aluno-agendar-mentoria', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/mentoria`)
  await settle(page)
  await page.getByRole('button', { name: 'Agendar' }).first().click()
  const dialog = page.getByRole('dialog')
  const confirmar = dialog.getByRole('button', { name: /Confirmar agendamento/ })
  const desabilitadoSemHorario = await confirmar.isDisabled()
  await dialog.locator('button[aria-pressed]').first().click()
  const desabilitadoSemTema = await confirmar.isDisabled()
  await dialog.locator('textarea').fill(`${XSS} ${SQL}`)
  await clearMockLog()
  await configMock({ delayMs: 700 })
  await confirmar.dblclick()
  await page.waitForTimeout(3000)
  return { desabilitadoSemHorario, desabilitadoSemTema, chamadasRpc: await writes(/book_mentor_session/), mensagem: (await dialog.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200) }
})
await caso('aluno-entrega-link-sem-https', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/atividades`)
  await settle(page)
  await page.getByRole('button', { name: /Resolver/ }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Sua resposta').fill('Minha resposta')
  await dialog.getByLabel('Link da entrega (opcional)').fill('www.github.com/fulano/projeto')
  await dialog.getByRole('button', { name: /Enviar/ }).click()
  await page.waitForTimeout(800)
  return { erro: await shownError(page), nativa: await nativeMsg(dialog.getByLabel('Link da entrega (opcional)')) }
})
await caso('aluno-chat', async (page) => {
  await login(page, 'student')
  await page.goto(`${APP}/aluno/duvidas`)
  await settle(page)
  const input = page.getByPlaceholder(/Escreva uma mensagem/)
  await input.fill('     ')
  const enviarComEspacos = await page.getByRole('button', { name: 'Enviar' }).isEnabled()
  await input.fill('x'.repeat(2500))
  const tamanhoAceito = (await input.inputValue()).length
  await input.fill(`${XSS} ${EMOJI}`)
  await clearMockLog()
  await configMock({ delayMs: 600 })
  await input.press('Enter')
  await input.press('Enter')
  await page.getByRole('button', { name: 'Enviar' }).click().catch(() => {})
  await page.waitForTimeout(2500)
  return { enviarHabilitadoSoComEspacos: enviarComEspacos, tamanhoAceito, insercoes: await writes(/mentor_messages/) }
})

// ------------------------------------------------------------------ mentor
await caso('mentor-preco', async (page) => {
  await login(page, 'mentor')
  await page.goto(`${APP}/mentor/perfil`)
  const preco = page.getByLabel('Valor por sessão (R$)')
  const r = {}
  for (const v of ['-5', '150,50', '1e12', 'abc']) {
    await preco.fill('').catch(() => {})
    await preco.pressSequentially(v)
    r[v] = { noCampo: await preco.inputValue(), valido: await preco.evaluate((el) => el.checkValidity()) }
  }
  await preco.fill('99999999999')
  await clearMockLog()
  await page.getByRole('button', { name: 'Salvar perfil' }).click()
  await page.waitForTimeout(1200)
  r.gravado = (await mock('/__qa/state?table=mentors')).find((m) => m.email === 'beatriz@qa.example.com')?.price_per_session
  await page.goto(`${APP}/mentor`)
  return r
})
await caso('mentor-horario-invalido-e-duplo', async (page) => {
  await login(page, 'mentor')
  await page.goto(`${APP}/mentor/horarios`)
  await page.getByLabel('Início').fill('18:00')
  await page.getByLabel('Fim').fill('09:00')
  await page.getByRole('button', { name: /Adicionar horário/ }).click()
  await page.waitForTimeout(400)
  const erroFimAntes = await shownError(page)
  await page.getByLabel('Dia da semana').selectOption('Sábado')
  await page.getByLabel('Início').fill('08:00')
  await page.getByLabel('Fim').fill('09:00')
  await clearMockLog()
  await configMock({ delayMs: 700 })
  await page.getByRole('button', { name: /Adicionar horário/ }).dblclick()
  await page.waitForTimeout(2500)
  return { erroFimAntes, insercoes: await writes(/availability/) }
})

// ------------------------------------------------------------------ empresa
await caso('empresa-curso-validacoes-e-duplo', async (page) => {
  await login(page, 'company')
  await page.goto(`${APP}/empresa/cursos`)
  await page.getByRole('button', { name: 'Novo curso' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Título do curso').fill(LONG)
  await d.getByLabel('Descrição / resumo').fill(`${XSS} ${SQL}`)
  await d.getByLabel('Carga horária total (h)').fill('0')
  await d.getByLabel('Instrutor responsável').fill('Instrutor QA')
  await d.getByLabel('Imagem de capa (URL)').fill('javascript:alert(1)')
  await d.getByRole('button', { name: 'Criar curso' }).click()
  await page.waitForTimeout(400)
  const erro1 = await shownError(page)
  await d.getByLabel('Carga horária total (h)').fill('10')
  await d.getByRole('button', { name: 'Criar curso' }).click()
  await page.waitForTimeout(400)
  const erro2 = await shownError(page)
  await d.getByLabel('Imagem de capa (URL)').fill('')
  await d.getByPlaceholder('Título do módulo').first().fill('Módulo 1')
  await d.getByPlaceholder(/Aulas/).first().fill('Aula 1\nAula 2')
  await clearMockLog()
  await configMock({ delayMs: 700 })
  await d.getByRole('button', { name: 'Criar curso' }).dblclick()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: shotName('form', 'curso-titulo-5000-lista'), fullPage: true })
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  return { erro1, erro2, insercoesCurso: await writes(/\/rest\/v1\/courses/), overflowX }
})
await caso('empresa-treinamento-datas-invertidas', async (page) => {
  await login(page, 'company')
  await page.goto(`${APP}/empresa/treinamentos`)
  await page.getByRole('button', { name: 'Novo treinamento' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Nome do treinamento').fill('Treino QA')
  await d.getByLabel('Data de início').fill('2027-05-10')
  await d.getByLabel('Data de término').fill('2027-01-01')
  await d.getByRole('button', { name: 'Criar treinamento' }).click()
  await page.waitForTimeout(400)
  return { erro: await shownError(page) }
})
await caso('empresa-vaga-titulo-5000', async (page) => {
  await login(page, 'company')
  await page.goto(`${APP}/empresa/vagas`)
  await page.getByRole('button', { name: 'Nova vaga' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Título da vaga').fill(LONG)
  await d.getByLabel('Descrição da vaga').fill(XSS)
  await d.getByLabel('Área / departamento').fill('TI')
  await d.getByLabel('Localização').fill(EMOJI)
  await clearMockLog()
  await d.getByRole('button', { name: 'Publicar vaga' }).click()
  await page.waitForTimeout(1500)
  const erro = await shownError(page)
  await page.screenshot({ path: shotName('form', 'vaga-titulo-5000-lista'), fullPage: true })
  return { erro, insercoes: await writes(/\/rest\/v1\/jobs/), overflowX: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) }
})
await caso('empresa-vincular-aluno-email-inexistente', async (page) => {
  await login(page, 'company')
  await page.goto(`${APP}/empresa/alunos`)
  await page.getByRole('button', { name: 'Convidar aluno' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('E-mail do aluno').fill('ninguem@qa.example.com')
  await d.getByRole('button', { name: 'Vincular aluno' }).click()
  await page.waitForTimeout(1500)
  return { erro: await shownError(page) }
})
await caso('empresa-cadastrar-mentor-funcao-ausente', async (page) => {
  await login(page, 'company')
  await page.goto(`${APP}/empresa/mentores`)
  await page.getByRole('button', { name: 'Cadastrar mentor' }).first().click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Nome').fill('Mentor Direto')
  await d.getByLabel('E-mail').fill('direto@qa.example.com')
  await d.getByLabel('Senha provisória').fill('senha12345')
  await d.getByRole('button', { name: 'Cadastrar mentor' }).click()
  await page.waitForTimeout(1500)
  return { erro: await shownError(page) }
})
await caso('empresa-config-logo-invalido-e-admin', async (page) => {
  await login(page, 'company')
  await page.goto(`${APP}/empresa/configuracoes`)
  await page.getByLabel('URL do logo').fill('ftp://logo.png')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await page.waitForTimeout(600)
  const erroLogo = await shownError(page)
  await page.getByPlaceholder('Nome completo').fill('Novo Admin')
  await page.getByPlaceholder('email@empresa.com').fill('novoadmin@qa.example.com')
  await page.getByLabel('Senha provisória').fill('senha12345')
  await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.waitForTimeout(1500)
  return { erroLogo, erroAdmin: await shownError(page) }
})

await browser.close()
saveJson('30-formularios.json', out)
