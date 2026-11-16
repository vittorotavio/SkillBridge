// Supabase FALSO para a auditoria de QA: imita o suficiente de Auth (GoTrue), PostgREST, RPCs e
// Edge Functions para o front rodar sem tocar no projeto real (produção). Tudo em memória.
//
// Controle (para os testes):
//   POST /__qa/reset                 → volta aos dados iniciais
//   POST /__qa/config  {json}        → { delayMs, failRest: 500|null, failAuth: 500|null, failPath: "regex", hang: bool }
//   GET  /__qa/log  /  POST /__qa/log/clear → requisições recebidas (método, caminho, usuário, status)
//   POST /__qa/confirm?email=...     → confirma o e-mail de uma conta criada pelo cadastro
//   GET  /__qa/state?table=...       → linhas atuais de uma tabela
import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { buildFixtures, PRIMARY_KEYS } from './fixtures.mjs'

const PORT = Number(process.env.MOCK_PORT ?? 54399)

let db, authUsers
let config = {}
let log = []
function reset() {
  const f = buildFixtures()
  db = f.tables
  authUsers = f.users
  config = {}
}
reset()

// ---------------------------------------------------------------- utilidades
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
function makeJwt(user) {
  const now = Math.floor(Date.now() / 1000)
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: randomUUID() })}.qa-fake-signature`
}
function subFromAuth(req) {
  const h = req.headers.authorization ?? ''
  const token = h.replace(/^Bearer\s+/i, '')
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).sub ?? null
  } catch {
    return null
  }
}
function publicUser(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.confirmed ? new Date().toISOString() : null,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: u.user_metadata,
    identities: [{ id: u.id, user_id: u.id, identity_id: u.id, provider: 'email', identity_data: { email: u.email, sub: u.id } }],
    created_at: new Date(0).toISOString(),
    updated_at: new Date().toISOString(),
  }
}
function session(u) {
  const now = Math.floor(Date.now() / 1000)
  return { access_token: makeJwt(u), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `qa-refresh-${u.id}`, user: publicUser(u) }
}
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Range, X-Supabase-Api-Version',
}
function send(res, status, body, extra = {}) {
  res.writeHead(status, { ...cors, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extra })
  res.end(body === undefined ? undefined : JSON.stringify(body))
  return status
}
const pgError = (res, status, code, message, details = null) => send(res, status, { code, message, details, hint: null })
const authError = (res, status, error_code, msg) => send(res, status, { code: status, error_code, msg })

async function readBody(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

// ---------------------------------------------------------------- PostgREST
function parseFilters(searchParams) {
  const filters = []
  for (const [key, value] of searchParams) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue
    const m = /^(not\.)?(eq|neq|is|in|gt|gte|lt|lte|like|ilike)\.(.*)$/s.exec(value)
    if (!m) continue
    filters.push({ col: key, neg: !!m[1], op: m[2], val: m[3] })
  }
  return filters
}
function matches(row, f) {
  const v = row[f.col]
  let ok
  switch (f.op) {
    case 'eq': ok = String(v) === f.val; break
    case 'neq': ok = String(v) !== f.val; break
    case 'is': ok = f.val === 'null' ? v === null || v === undefined : String(v) === f.val; break
    case 'in': {
      const list = f.val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''))
      ok = list.includes(String(v))
      break
    }
    case 'gt': ok = v > f.val; break
    case 'gte': ok = v >= f.val; break
    case 'lt': ok = v < f.val; break
    case 'lte': ok = v <= f.val; break
    default: ok = true
  }
  return f.neg ? !ok : ok
}
function embed(table, row) {
  const r = { ...row }
  const by = (t, col, val) => (db[t] ?? []).filter((x) => x[col] === val)
  switch (table) {
    case 'students':
      r.enrollments = by('enrollments', 'student_id', row.id).map(({ course_id, status }) => ({ course_id, status }))
      r.certificates = by('certificates', 'student_id', row.id).map(({ id }) => ({ id }))
      break
    case 'mentors':
      r.mentor_programs = by('mentor_programs', 'mentor_id', row.id).map(({ program_id }) => ({ program_id }))
      r.availability = by('availability', 'mentor_id', row.id)
      break
    case 'companies':
      r.company_admins = by('company_admins', 'company_id', row.id).map(({ id, name, email, role }) => ({ id, name, email, role }))
      break
    case 'courses':
      r.modules = by('modules', 'course_id', row.id)
      r.course_programs = by('course_programs', 'course_id', row.id).map(({ program_id }) => ({ program_id }))
      break
    case 'programs':
      r.course_programs = by('course_programs', 'program_id', row.id).map(({ course_id }) => ({ course_id }))
      r.mentor_programs = by('mentor_programs', 'program_id', row.id).map(({ mentor_id }) => ({ mentor_id }))
      r.students = by('students', 'program_id', row.id).map(({ id }) => ({ id }))
      break
    case 'jobs':
      r.job_programs = by('job_programs', 'job_id', row.id).map(({ program_id }) => ({ program_id }))
      break
    case 'mentor_sessions': {
      const n = by('mentor_session_notes', 'session_id', row.id)[0]
      r.mentor_session_notes = n ? { notes: n.notes } : null
      break
    }
  }
  return r
}
function project(select, row) {
  if (!select || select.includes('*') || select.includes('(')) return row
  const cols = select.split(',').map((s) => s.trim())
  return Object.fromEntries(cols.map((c) => [c, row[c]]))
}
function order(rows, orderParam) {
  if (!orderParam) return rows
  const [col, dir] = orderParam.split('.')
  return [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (dir === 'desc' ? -1 : 1))
}
const DEFAULTS = {
  students: () => ({ avatar_url: null, bio: null, company_id: null, program_id: null, study_hours: 0 }),
  mentors: () => ({ avatar_url: null, rating: 0, reviews_count: 0, price_per_session: 0, company_id: null }),
  courses: () => ({ enrolled_count: 0, rating: 0 }),
  jobs: () => ({ applications_count: 0, created_at: new Date().toISOString() }),
  mentor_invites: () => ({ status: 'pendente', invited_at: new Date().toISOString() }),
  mentor_messages: () => ({ read: false, created_at: new Date().toISOString() }),
  mentor_activities: () => ({ status: 'pendente', created_at: new Date().toISOString(), submission: null, submission_url: null, submitted_at: null, feedback: null, reviewed_at: null }),
  enrollment_requests: () => ({ status: 'pendente', requested_at: new Date().toISOString() }),
  availability: () => ({ booked: false }),
  modules: () => ({}),
}
const UNIQUE = { companies: ['cnpj'], mentor_invites: ['email', 'company_id'] }

function insertRows(table, rows, upsert) {
  db[table] ??= []
  const pk = PRIMARY_KEYS[table] ?? ['id']
  const out = []
  for (const input of rows) {
    const row = { ...(DEFAULTS[table]?.() ?? {}), ...input }
    if (pk.includes('id') && !row.id) row.id = randomUUID()
    const samePk = (x) => pk.every((k) => String(x[k]) === String(row[k]))
    const existing = db[table].find(samePk)
    if (existing) {
      if (upsert) {
        Object.assign(existing, row)
        out.push(existing)
        continue
      }
      return { error: { status: 409, code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"` } }
    }
    for (const col of UNIQUE[table] ?? []) {
      if (row[col] != null && db[table].some((x) => x[col] === row[col])) {
        return { error: { status: 409, code: '23505', message: `duplicate key value violates unique constraint "${table}_${col}_key"` } }
      }
    }
    db[table].push(row)
    out.push(row)
  }
  return { rows: out }
}

function handleRest(req, res, url, body, table) {
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const prefer = req.headers.prefer ?? ''
  const wantsRows = prefer.includes('return=representation')
  const filters = parseFilters(url.searchParams)
  const select = url.searchParams.get('select')
  if (!(table in PRIMARY_KEYS)) return pgError(res, 404, 'PGRST205', `Could not find the table 'public.${table}' in the schema cache`)
  const rows = db[table] ?? []

  const reply = (list) => {
    const shaped = list.map((r) => project(select, embed(table, r)))
    if (single) {
      if (shaped.length !== 1) return pgError(res, 406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned')
      return send(res, 200, shaped[0])
    }
    return send(res, 200, shaped)
  }

  switch (req.method) {
    case 'GET':
    case 'HEAD':
      return reply(order(rows.filter((r) => filters.every((f) => matches(r, f))), url.searchParams.get('order')))
    case 'POST': {
      const list = Array.isArray(body) ? body : [body]
      const { rows: inserted, error } = insertRows(table, list, prefer.includes('merge-duplicates'))
      if (error) return pgError(res, error.status, error.code, error.message)
      return wantsRows ? reply(inserted) : send(res, 201, undefined)
    }
    case 'PATCH': {
      const hit = rows.filter((r) => filters.every((f) => matches(r, f)))
      hit.forEach((r) => Object.assign(r, body))
      return wantsRows ? reply(hit) : send(res, 204, undefined)
    }
    case 'DELETE': {
      const hit = rows.filter((r) => filters.every((f) => matches(r, f)))
      db[table] = rows.filter((r) => !hit.includes(r))
      return wantsRows ? reply(hit) : send(res, 204, undefined)
    }
  }
  return pgError(res, 405, 'PGRST000', 'method not allowed')
}

// ---------------------------------------------------------------- RPCs
function handleRpc(req, res, fn, body, sub) {
  const p = body ?? {}
  const today = new Date().toISOString().slice(0, 10)
  switch (fn) {
    case 'release_past_session_slots':
    case 'accept_mentor_invites':
      return send(res, 200, null)
    case 'enroll_in_course':
      insertRows('enrollments', [{ student_id: sub, course_id: p.p_course_id, status: 'em_andamento' }], true)
      return send(res, 200, null)
    case 'apply_to_job': {
      if (db.job_applications.some((a) => a.job_id === p.p_job_id && a.student_id === sub)) return pgError(res, 409, '23505', 'duplicate key value violates unique constraint "job_applications_job_id_student_id_key"')
      insertRows('job_applications', [{ job_id: p.p_job_id, student_id: sub, status: 'enviada', applied_at: new Date().toISOString() }])
      return send(res, 200, null)
    }
    case 'book_mentor_session': {
      const slot = db.availability.find((a) => a.id === p.p_availability_id)
      if (!slot || slot.booked) return pgError(res, 400, 'P0001', 'slot_unavailable')
      slot.booked = true
      insertRows('mentor_sessions', [{ mentor_id: slot.mentor_id, student_id: sub, date: p.p_date, start_time: slot.start_time, end_time: slot.end_time, status: 'agendada', topic: p.p_topic, rating: null, review: null }])
      return send(res, 200, null)
    }
    case 'invite_existing_student': {
      const st = db.students.find((s) => s.email.toLowerCase() === String(p.p_email ?? '').trim().toLowerCase())
      if (!st) return pgError(res, 400, 'P0001', 'student_not_found')
      const program = db.programs.find((x) => x.id === p.p_program_id)
      insertRows('enrollment_requests', [{ student_id: st.id, company_id: program?.company_id, program_id: p.p_program_id }])
      return send(res, 200, null)
    }
    case 'complete_lesson': {
      insertRows('lesson_progress', [{ student_id: sub, course_id: p.p_course_id, module_index: p.p_module_index, lesson_index: p.p_lesson_index }], true)
      const total = db.modules.filter((m) => m.course_id === p.p_course_id).reduce((n, m) => n + m.lessons.length, 0)
      const done = db.lesson_progress.filter((l) => l.student_id === sub && l.course_id === p.p_course_id).length
      const completed = total > 0 && done >= total
      if (completed) {
        const e = db.enrollments.find((x) => x.student_id === sub && x.course_id === p.p_course_id)
        if (e) e.status = 'concluido'
        const c = db.courses.find((x) => x.id === p.p_course_id)
        insertRows('certificates', [{ student_id: sub, course_id: p.p_course_id, issued_at: new Date().toISOString(), course_title: c?.title, course_hours: c?.total_hours, instructor: c?.instructor, company_name: null }])
      }
      return send(res, 200, { done, total, course_completed: completed })
    }
    case 'submit_activity': {
      const a = db.mentor_activities.find((x) => x.id === p.p_activity_id)
      if (!a) return pgError(res, 400, 'P0001', 'not_found')
      Object.assign(a, { status: 'entregue', submission: p.p_answer, submission_url: p.p_url, submitted_at: new Date().toISOString() })
      return send(res, 200, null)
    }
    case 'cancel_mentor_session': {
      const s = db.mentor_sessions.find((x) => x.id === p.p_session_id)
      if (s) s.status = 'cancelada'
      return send(res, 200, null)
    }
    case 'review_mentor_session': {
      const s = db.mentor_sessions.find((x) => x.id === p.p_session_id)
      if (s) Object.assign(s, { rating: p.p_rating, review: p.p_review, status: 'concluida' })
      return send(res, 200, null)
    }
    case 'unlink_company_mentor': {
      const m = db.mentors.find((x) => x.id === p.p_mentor_id)
      if (m) m.company_id = null
      db.mentor_programs = db.mentor_programs.filter((x) => x.mentor_id !== p.p_mentor_id)
      return send(res, 200, null)
    }
  }
  void today
  return pgError(res, 404, 'PGRST202', `Could not find the function public.${fn} without parameters in the schema cache`)
}

// ---------------------------------------------------------------- Auth
async function handleAuth(req, res, url, body, path) {
  if (path === '/auth/v1/token') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'password') {
      const u = authUsers.find((x) => x.email.toLowerCase() === String(body?.email ?? '').toLowerCase())
      if (!u || u.password !== body?.password) return authError(res, 400, 'invalid_credentials', 'Invalid login credentials')
      if (!u.confirmed) return authError(res, 400, 'email_not_confirmed', 'Email not confirmed')
      return send(res, 200, session(u))
    }
    if (grant === 'refresh_token') {
      const id = String(body?.refresh_token ?? '').replace('qa-refresh-', '')
      const u = authUsers.find((x) => x.id === id)
      if (!u) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
      return send(res, 200, session(u))
    }
  }
  if (path === '/auth/v1/user') {
    const sub = subFromAuth(req)
    const u = authUsers.find((x) => x.id === sub)
    if (!u) return authError(res, 401, 'bad_jwt', 'invalid JWT')
    return send(res, 200, publicUser(u))
  }
  if (path === '/auth/v1/logout') return send(res, 204, undefined)
  if (path === '/auth/v1/signup') {
    const email = String(body?.email ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authError(res, 400, 'email_address_invalid', `Email address "${email}" is invalid`)
    if (String(body?.password ?? '').length < 6) return authError(res, 422, 'weak_password', 'Password should be at least 6 characters.')
    const existing = authUsers.find((x) => x.email.toLowerCase() === email.toLowerCase())
    if (existing) {
      // Igual ao Supabase com confirmação de e-mail: usuário "ofuscado", identities vazio.
      return send(res, 200, { ...publicUser(existing), id: randomUUID(), identities: [], user_metadata: {} })
    }
    const u = { id: randomUUID(), email, password: body.password, confirmed: false, user_metadata: body.data ?? {}, account_type: body.data?.account_type }
    authUsers.push(u)
    db.profiles.push({ id: u.id, account_type: u.account_type })
    return send(res, 200, publicUser(u))
  }
  if (path === '/auth/v1/recover') return send(res, 200, {})
  return authError(res, 404, 'not_found', 'not found')
}

// ---------------------------------------------------------------- servidor
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname
  if (req.method === 'OPTIONS') return send(res, 204, undefined)
  const body = await readBody(req)

  // ---- controle da auditoria
  if (path.startsWith('/__qa/')) {
    if (path === '/__qa/reset') return reset(), (log = []), send(res, 200, { ok: true })
    if (path === '/__qa/config') return (config = body ?? {}), send(res, 200, config)
    if (path === '/__qa/log') return send(res, 200, log)
    if (path === '/__qa/log/clear') return (log = []), send(res, 200, { ok: true })
    if (path === '/__qa/state') return send(res, 200, db[url.searchParams.get('table')] ?? null)
    if (path === '/__qa/confirm') {
      const u = authUsers.find((x) => x.email === url.searchParams.get('email'))
      if (u) u.confirmed = true
      return send(res, 200, { ok: !!u })
    }
    return send(res, 404, { error: 'unknown' })
  }

  const sub = subFromAuth(req)
  const entry = { t: Date.now(), method: req.method, path, query: url.search, user: sub, body: body && JSON.stringify(body).slice(0, 300) }
  log.push(entry)

  if (config.hang && (!config.failPath || new RegExp(config.failPath).test(path))) return // nunca responde
  if (config.delayMs) await new Promise((r) => setTimeout(r, config.delayMs))
  const pathHit = !config.failPath || new RegExp(config.failPath).test(path)
  if (config.failRest && pathHit && path.startsWith('/rest/')) return (entry.status = pgError(res, config.failRest, 'XX000', 'internal server error (simulado)'))
  if (config.failAuth && pathHit && path.startsWith('/auth/')) return (entry.status = send(res, config.failAuth, { code: config.failAuth, error_code: 'unexpected_failure', msg: 'simulado' }))

  if (path.startsWith('/auth/v1/')) return (entry.status = await handleAuth(req, res, url, body, path))
  const rpc = /^\/rest\/v1\/rpc\/([\w]+)$/.exec(path)
  if (rpc) return (entry.status = handleRpc(req, res, rpc[1], body, sub))
  const rest = /^\/rest\/v1\/([\w]+)$/.exec(path)
  if (rest) return (entry.status = handleRest(req, res, url, body, rest[1]))
  if (path.startsWith('/functions/v1/')) return (entry.status = send(res, 404, { error: 'Function not found' }))
  entry.status = 404
  res.writeHead(404, cors).end()
})

server.listen(PORT, '127.0.0.1', () => console.log(`[mock-supabase] ouvindo em http://127.0.0.1:${PORT}`))
