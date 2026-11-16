// 1.4-I — Lighthouse (mobile, padrão) nas telas públicas principais, contra o build de produção servido pelo vite preview.
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { CHROME_PATH, APP, saveJson, resetMock } from './lib.mjs'

await resetMock()
const chrome = await chromeLauncher.launch({ chromePath: CHROME_PATH, chromeFlags: ['--headless=new', '--no-sandbox'] })
const out = {}
for (const route of ['/', '/login', '/cadastro', '/cadastro/empresa', '/sobre']) {
  const r = await lighthouse(`${APP}${route}`, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] })
  const lhr = r.lhr
  const score = (k) => Math.round((lhr.categories[k]?.score ?? 0) * 100)
  const failed = Object.values(lhr.audits)
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'manual' && a.scoreDisplayMode !== 'notApplicable')
    .map((a) => `${a.id}: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}`)
  out[route] = {
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    seo: score('seo'),
    FCP: lhr.audits['first-contentful-paint'].displayValue,
    LCP: lhr.audits['largest-contentful-paint'].displayValue,
    TBT: lhr.audits['total-blocking-time'].displayValue,
    CLS: lhr.audits['cumulative-layout-shift'].displayValue,
    totalBytes: lhr.audits['total-byte-weight'].displayValue,
    failed,
  }
  console.log(route, JSON.stringify(out[route], null, 1))
}
await chrome.kill()
saveJson('60-lighthouse.json', out)
