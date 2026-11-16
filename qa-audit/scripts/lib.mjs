// Utilitários comuns dos testes da auditoria (Playwright + Supabase falso).
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const QA_DIR = path.resolve(here, '..')
export const SHOTS = path.join(QA_DIR, 'screenshots')
export const RESULTS = path.join(QA_DIR, 'logs')
export const APP = process.env.QA_APP ?? 'http://127.0.0.1:4173'
export const APP_NOENV = 'http://127.0.0.1:4174'
export const MOCK = 'http://127.0.0.1:54399'
export const PASSWORD = 'Teste#123'

// Chromium já instalado na máquina (o Playwright 1.65 pediria baixar outra revisão).
const LOCAL_CHROME = 'C:/Users/vitor/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe'
export const CHROME_PATH = fs.existsSync(LOCAL_CHROME) ? LOCAL_CHROME : undefined

export const ACCOUNTS = {
  student: { email: 'rafael@qa.example.com', tab: 'Aluno', home: '/aluno' },
  studentNoCompany: { email: 'marina@qa.example.com', tab: 'Aluno', home: '/aluno' },
  mentor: { email: 'beatriz@qa.example.com', tab: 'Mentor', home: '/mentor' },
  companyMentor: { email: 'eduardo@qa.example.com', tab: 'Mentor', home: '/mentor' },
  company: { email: 'ana@qa.example.com', tab: 'Empresa', home: '/empresa' },
}

export const ROUTES = {
  public: ['/', '/login', '/cadastro', '/cadastro/empresa'],
  student: ['/aluno', '/aluno/cursos', '/aluno/cursos/k0000000-0000-4000-8000-000000000001', '/aluno/cursos/k0000000-0000-4000-8000-000000000001/aulas', '/aluno/certificados/ce000000-0000-4000-8000-000000000001', '/aluno/atividades', '/aluno/mentoria', '/aluno/duvidas', '/aluno/vagas', '/aluno/perfil'],
  company: ['/empresa', '/empresa/alunos', '/empresa/mentores', '/empresa/cursos', '/empresa/treinamentos', '/empresa/vagas', '/empresa/relatorios', '/empresa/configuracoes'],
  mentor: ['/mentor', '/mentor/horarios', '/mentor/alunos', '/mentor/atividades', '/mentor/duvidas', '/mentor/historico', '/mentor/perfil'],
}

export async function mock(pathname, body) {
  const res = await fetch(`${MOCK}${pathname}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  return res.json()
}
export const resetMock = () => mock('/__qa/reset', {})
export const configMock = (cfg) => mock('/__qa/config', cfg)
export const mockLog = () => mock('/__qa/log')
export const clearMockLog = () => mock('/__qa/log/clear', {})

export async function launch(opts = {}) {
  return chromium.launch({ executablePath: CHROME_PATH, headless: true, ...opts })
}

/** Abre um contexto com coleta de console, erros de página e requisições que falharam. */
export async function newPage(browser, ctxOpts = {}) {
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', ...ctxOpts })
  const page = await context.newPage()
  const events = { console: [], pageErrors: [], failed: [], http4xx5xx: [], dialogs: [] }
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') events.console.push({ type: m.type(), text: m.text().slice(0, 500), url: page.url() })
  })
  page.on('pageerror', (e) => events.pageErrors.push({ message: String(e.message).slice(0, 500), url: page.url() }))
  page.on('requestfailed', (r) => events.failed.push({ url: r.url(), error: r.failure()?.errorText }))
  page.on('response', (r) => {
    if (r.status() >= 400) events.http4xx5xx.push({ status: r.status(), url: r.url().slice(0, 200), method: r.request().method() })
  })
  page.on('dialog', async (d) => {
    events.dialogs.push({ type: d.type(), message: d.message() })
    await d.dismiss().catch(() => {})
  })
  return { context, page, events }
}

export async function login(page, account, { waitHome = true } = {}) {
  const a = typeof account === 'string' ? ACCOUNTS[account] : account
  await page.goto(`${APP}/login`)
  await page.getByRole('button', { name: a.tab, exact: true }).click()
  await page.getByLabel('E-mail').fill(a.email)
  await page.getByLabel('Senha').fill(a.password ?? PASSWORD)
  await page.getByRole('button', { name: new RegExp(`^Entrar como`) }).click()
  if (waitHome) await page.waitForURL((u) => u.pathname.startsWith(a.home), { timeout: 15000 })
}

export async function settle(page, ms = 400) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(ms)
}

export function shotName(...parts) {
  return path.join(SHOTS, parts.join('_').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-') + '.png')
}

export function saveJson(name, data) {
  fs.mkdirSync(RESULTS, { recursive: true })
  const file = path.join(RESULTS, name)
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
  return file
}

/** Textos "técnicos" ou quebrados visíveis na página. */
export async function findBadText(page) {
  const text = await page.evaluate(() => document.body.innerText)
  const patterns = [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\[object Object\]/, /Error \d{3}/i, /\bError\b/, /Invalid Date/, /\bfailed\b/i, /\bTypeError\b/, /duplicate key/i, /violates/i, /PGRST/i, /JWT/i]
  return patterns.filter((p) => p.test(text)).map((p) => {
    const m = text.match(p)
    const i = m?.index ?? 0
    return { pattern: String(p), context: text.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, ' ') }
  })
}
