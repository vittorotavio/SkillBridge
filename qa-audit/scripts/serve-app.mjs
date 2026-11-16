// Compila o app (build de produção) com as variáveis da auditoria e serve com `vite preview`.
// Nada é escrito no projeto: a saída vai para qa-audit/dist-qa-<perfil>.
//   node scripts/serve-app.mjs mock   → app apontando para o Supabase falso (porta 4173)
//   node scripts/serve-app.mjs empty  → app sem VITE_SUPABASE_* (porta 4174)
//
// O .env do projeto (que aponta para o Supabase de produção) NUNCA é lido: `envDir` aponta para esta
// pasta de scripts, que não tem arquivos .env, e os valores vêm de PROFILES abaixo (variáveis do
// processo têm prioridade sobre arquivos .env no Vite).
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { build, preview } from 'vite'

const PROFILES = {
  mock: { port: 4173, env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54399', VITE_SUPABASE_ANON_KEY: 'qa-fake-anon-key' } },
  empty: { port: 4174, env: {} },
}
const name = process.argv[2] ?? 'mock'
const profile = PROFILES[name]
if (!profile) throw new Error(`perfil desconhecido: ${name}`)

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const outDir = path.resolve(here, `../dist-qa-${name}`)
delete process.env.VITE_SUPABASE_URL
delete process.env.VITE_SUPABASE_ANON_KEY
Object.assign(process.env, profile.env)
// PostCSS/Tailwind procuram a configuração a partir da pasta atual.
process.chdir(root)

const common = { root, envDir: here, logLevel: 'warn' }
await build({ ...common, build: { outDir, emptyOutDir: true } })
// Garantia: o build não pode conter o endereço do projeto real.
const { readdirSync, readFileSync } = await import('node:fs')
const assets = path.join(outDir, 'assets')
// (a biblioteca contém o texto genérico "*.supabase.co"; o que não pode existir é a URL de um projeto real)
const projectUrl = /https:\/\/[a-z0-9]{20}\.supabase\.co/
const leak = readdirSync(assets).filter((f) => f.endsWith('.js') && projectUrl.test(readFileSync(path.join(assets, f), 'utf8')))
if (leak.length) throw new Error(`build contém endereço *.supabase.co: ${leak.join(', ')}`)
const server = await preview({ ...common, build: { outDir }, preview: { port: profile.port, strictPort: true, host: '127.0.0.1' } })
server.printUrls()
