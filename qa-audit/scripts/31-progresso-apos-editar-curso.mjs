// 1.4-D — O progresso do aluno é gravado por posição (módulo, aula). Se a empresa insere/remove uma aula
// antes, o "concluído" passa a apontar para outra aula. Demonstração pela interface real (dados no mock).
import { launch, newPage, login, settle, shotName, saveJson, resetMock, mock, APP } from './lib.mjs'

const K5 = 'k0000000-0000-4000-8000-000000000005'
await resetMock()
const browser = await launch()
const out = {}

// 1) aluno conclui a 1ª aula do curso da empresa
{
  const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 900 } })
  await login(page, 'student')
  await page.goto(`${APP}/aluno/cursos/${K5}/aulas?aula=0-0`)
  await settle(page)
  await page.getByRole('button', { name: /Concluir/ }).click()
  await page.waitForTimeout(1200)
  await page.goto(`${APP}/aluno/cursos/${K5}`)
  await settle(page)
  out.antes = (await page.locator('main').innerText()).match(/Onboarding — aula \d/g)
  out.progressoGravado = (await mock('/__qa/state?table=lesson_progress')).filter((p) => p.course_id === K5)
  await page.screenshot({ path: shotName('progresso', '1-aluno-concluiu-aula-1'), fullPage: true })
  await context.close()
}
// 2) empresa insere uma aula nova no topo do módulo
{
  const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 900 } })
  await login(page, 'company')
  await page.goto(`${APP}/empresa/cursos`)
  await settle(page)
  await page.getByRole('button', { name: 'Editar' }).first().click()
  const aulas = page.getByLabel('Aulas do módulo 1')
  const atual = await aulas.inputValue()
  await aulas.fill(`Aula de boas-vindas (nova)\n${atual}`)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await page.waitForTimeout(1500)
  await context.close()
}
// 3) aluno volta ao curso
{
  const { context, page } = await newPage(browser, { viewport: { width: 1280, height: 900 } })
  await login(page, 'student')
  await page.goto(`${APP}/aluno/cursos/${K5}`)
  await settle(page)
  const checks = await page.evaluate(() =>
    [...document.querySelectorAll('main li, main button, main div')]
      .filter((el) => /aula/i.test(el.textContent || '') && el.children.length <= 3)
      .slice(0, 0)
  )
  void checks
  await page.screenshot({ path: shotName('progresso', '2-aluno-depois-da-edicao'), fullPage: true })
  await page.goto(`${APP}/aluno/cursos/${K5}/aulas`)
  await settle(page)
  out.depois_proximaAulaSugerida = (await page.locator('main h2, main h1').allInnerTexts()).join(' | ')
  out.depois_textoPlayer = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 400)
  await page.screenshot({ path: shotName('progresso', '3-player-depois-da-edicao'), fullPage: true })
  await context.close()
}
await browser.close()
saveJson('31-progresso-apos-editar-curso.json', out)
console.log(JSON.stringify(out, null, 1))
