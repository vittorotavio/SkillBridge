// Dados 100% fictícios para o Supabase falso da auditoria (nenhum dado real/de produção).
// Datas relativas a "hoje" para que fases de treinamento, sessões futuras/passadas façam sentido.

const day = 86_400_000
const iso = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString()
const date = (offsetDays) => iso(offsetDays).slice(0, 10)

export const PASSWORD = 'Teste#123'

// ids legíveis (o app não exige UUID; o banco real usa uuid)
const C1 = 'c0000000-0000-4000-8000-000000000001' // TechNova QA
const C2 = 'c0000000-0000-4000-8000-000000000002' // Outra Empresa QA
const P1 = 'p0000000-0000-4000-8000-000000000001' // treinamento ativo C1
const P2 = 'p0000000-0000-4000-8000-000000000002' // treinamento futuro C1
const P3 = 'p0000000-0000-4000-8000-000000000003' // treinamento C2
const A1 = 'a0000000-0000-4000-8000-000000000001'
const A2 = 'a0000000-0000-4000-8000-000000000002'
const S1 = 's0000000-0000-4000-8000-000000000001' // aluno em treinamento (C1/P1)
const S2 = 's0000000-0000-4000-8000-000000000002' // aluno sem empresa
const S3 = 's0000000-0000-4000-8000-000000000003' // nome longo, sem dados
const S4 = 's0000000-0000-4000-8000-000000000004' // pediu para entrar no P1
const M1 = 'm0000000-0000-4000-8000-000000000001' // mentora pública
const M2 = 'm0000000-0000-4000-8000-000000000002' // mentor da C1 (P1)
const M3 = 'm0000000-0000-4000-8000-000000000003' // mentor público, bio enorme
const K1 = 'k0000000-0000-4000-8000-000000000001' // curso público publicado
const K2 = 'k0000000-0000-4000-8000-000000000002' // curso público publicado (concluído por S1)
const K3 = 'k0000000-0000-4000-8000-000000000003' // título enorme + XSS no texto
const K4 = 'k0000000-0000-4000-8000-000000000004' // rascunho público
const K5 = 'k0000000-0000-4000-8000-000000000005' // curso da C1 no P1
const K6 = 'k0000000-0000-4000-8000-000000000006' // curso da C2 no P3

export const IDS = { C1, C2, P1, P2, P3, A1, A2, S1, S2, S3, S4, M1, M2, M3, K1, K2, K3, K4, K5, K6 }

export function buildFixtures() {
  const users = [
    { id: S1, email: 'rafael@qa.example.com', account_type: 'student', name: 'Rafael Nogueira (QA)' },
    { id: S2, email: 'marina@qa.example.com', account_type: 'student', name: 'Marina Duarte (QA)' },
    { id: S3, email: 'longo@qa.example.com', account_type: 'student', name: 'Maria Aparecida dos Santos Albuquerque de Oliveira Cavalcanti Pereira da Silva (QA)' },
    { id: S4, email: 'bruno@qa.example.com', account_type: 'student', name: 'Bruno Castro (QA)' },
    { id: M1, email: 'beatriz@qa.example.com', account_type: 'mentor', name: 'Beatriz Lima (QA)' },
    { id: M2, email: 'eduardo@qa.example.com', account_type: 'mentor', name: 'Eduardo Silva (QA)' },
    { id: M3, email: 'carlos@qa.example.com', account_type: 'mentor', name: 'Carlos Andrade (QA)' },
    { id: A1, email: 'ana@qa.example.com', account_type: 'company_admin', name: 'Ana Admin (QA)' },
    { id: A2, email: 'otavio@qa.example.com', account_type: 'company_admin', name: 'Otávio Admin (QA)' },
  ].map((u) => ({ ...u, password: PASSWORD, confirmed: true, user_metadata: { account_type: u.account_type, name: u.name } }))

  const lessons = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix} — aula ${i + 1}`)

  const t = {
    profiles: users.map((u) => ({ id: u.id, account_type: u.account_type })),
    companies: [
      { id: C1, name: 'TechNova QA', razao_social: 'TechNova Soluções QA Ltda', cnpj: '11.222.333/0001-81', email: 'contato@technova.qa.example.com', sector: 'Tecnologia', logo_url: null },
      { id: C2, name: 'Outra Empresa QA', razao_social: 'Outra Empresa QA S.A.', cnpj: '45.723.174/0001-10', email: 'contato@outra.qa.example.com', sector: 'Varejo', logo_url: null },
    ],
    company_admins: [
      { id: A1, company_id: C1, name: 'Ana Admin (QA)', email: 'ana@qa.example.com', role: 'Admin Plataforma' },
      { id: A2, company_id: C2, name: 'Otávio Admin (QA)', email: 'otavio@qa.example.com', role: 'Admin Plataforma' },
    ],
    programs: [
      { id: P1, company_id: C1, name: 'Trilha Dev 2026', start_date: date(-60), end_date: date(40), description: 'Treinamento ativo de desenvolvimento.' },
      { id: P2, company_id: C1, name: 'Trilha Dados 2027', start_date: date(60), end_date: date(150), description: null },
      { id: P3, company_id: C2, name: 'Varejo Digital', start_date: date(-10), end_date: date(80), description: 'Treinamento da outra empresa.' },
    ],
    students: [
      { id: S1, name: 'Rafael Nogueira (QA)', email: 'rafael@qa.example.com', avatar_url: null, bio: 'Aluno de teste.', company_id: C1, program_id: P1, study_hours: 12 },
      { id: S2, name: 'Marina Duarte (QA)', email: 'marina@qa.example.com', avatar_url: null, bio: null, company_id: null, program_id: null, study_hours: 0 },
      { id: S3, name: users[2].name, email: 'longo@qa.example.com', avatar_url: null, bio: null, company_id: null, program_id: null, study_hours: 0 },
      { id: S4, name: 'Bruno Castro (QA)', email: 'bruno@qa.example.com', avatar_url: null, bio: null, company_id: null, program_id: null, study_hours: 3 },
    ],
    mentors: [
      { id: M1, name: 'Beatriz Lima (QA)', email: 'beatriz@qa.example.com', avatar_url: null, bio: 'Mentora de carreira e UX.', skills: ['UX Design', 'Carreira'], price_per_session: 0, rating: 4.8, reviews_count: 3, company_id: null },
      { id: M2, name: 'Eduardo Silva (QA)', email: 'eduardo@qa.example.com', avatar_url: null, bio: 'Mentor da TechNova.', skills: ['React', 'TypeScript'], price_per_session: 0, rating: 0, reviews_count: 0, company_id: C1 },
      { id: M3, name: 'Carlos Andrade (QA)', email: 'carlos@qa.example.com', avatar_url: null, bio: 'Bio muito longa. '.repeat(60).trim(), skills: ['Liderança', 'Vendas', 'Negociação', 'Gestão de pessoas', 'Comunicação não violenta', 'Produto'], price_per_session: 150, rating: 4.2, reviews_count: 10, company_id: null },
    ],
    mentor_programs: [{ mentor_id: M2, program_id: P1 }],
    availability: [
      { id: 'av000000-0000-4000-8000-000000000001', mentor_id: M1, weekday: 'Segunda', start_time: '10:00:00', end_time: '11:00:00', booked: false },
      { id: 'av000000-0000-4000-8000-000000000002', mentor_id: M1, weekday: 'Quarta', start_time: '14:00:00', end_time: '15:00:00', booked: true },
      { id: 'av000000-0000-4000-8000-000000000003', mentor_id: M1, weekday: 'Sexta', start_time: '09:00:00', end_time: '10:00:00', booked: false },
      { id: 'av000000-0000-4000-8000-000000000004', mentor_id: M2, weekday: 'Terça', start_time: '18:00:00', end_time: '19:00:00', booked: false },
    ],
    courses: [
      { id: K1, title: 'Fundamentos de React', summary: 'Componentes, estado e hooks na prática.', category: 'Tecnologia', total_hours: 12, instructor: 'Beatriz Lima (QA)', instructor_mentor_id: M1, cover_url: null, status: 'publicado', company_id: null, enrolled_count: 40, rating: 4.7 },
      { id: K2, title: 'Introdução a Dados', summary: 'SQL e visualização para iniciantes.', category: 'Dados', total_hours: 8, instructor: 'Carlos Andrade (QA)', instructor_mentor_id: M3, cover_url: null, status: 'publicado', company_id: null, enrolled_count: 25, rating: 4.5 },
      { id: K3, title: 'Curso com um título extremamente longo para verificar se o card quebra o layout da vitrine pública de cursos <img src=x onerror=alert(1)>', summary: '<script>alert("xss")</script> Resumo com marcação que deve aparecer como texto.', category: 'Liderança', total_hours: 3, instructor: 'Instrutor convidado', instructor_mentor_id: null, cover_url: 'javascript:alert(1)', status: 'publicado', company_id: null, enrolled_count: 0, rating: 0 },
      { id: K4, title: 'Rascunho Público (não deve aparecer)', summary: 'Rascunho.', category: 'Vendas', total_hours: 2, instructor: 'Ninguém', instructor_mentor_id: null, cover_url: null, status: 'rascunho', company_id: null, enrolled_count: 0, rating: 0 },
      { id: K5, title: 'Onboarding TechNova', summary: 'Curso exclusivo da TechNova QA.', category: 'Produto', total_hours: 4, instructor: 'Eduardo Silva (QA)', instructor_mentor_id: M2, cover_url: null, status: 'publicado', company_id: C1, enrolled_count: 1, rating: 0 },
      { id: K6, title: 'Curso Secreto da Outra Empresa', summary: 'Não deve vazar para a TechNova.', category: 'Marketing', total_hours: 5, instructor: 'Otávio', instructor_mentor_id: null, cover_url: null, status: 'publicado', company_id: C2, enrolled_count: 0, rating: 0 },
    ],
    modules: [
      { id: 'md000000-0000-4000-8000-000000000001', course_id: K1, title: 'Primeiros passos', duration: '2h', lessons: lessons(3, 'React'), position: 0 },
      { id: 'md000000-0000-4000-8000-000000000002', course_id: K1, title: 'Hooks', duration: '3h', lessons: lessons(2, 'Hooks'), position: 1 },
      { id: 'md000000-0000-4000-8000-000000000003', course_id: K2, title: 'SQL', duration: '4h', lessons: lessons(2, 'SQL'), position: 0 },
      { id: 'md000000-0000-4000-8000-000000000004', course_id: K3, title: 'Módulo único', duration: '1h', lessons: lessons(1, 'Único'), position: 0 },
      { id: 'md000000-0000-4000-8000-000000000005', course_id: K5, title: 'Boas-vindas', duration: '1h', lessons: lessons(2, 'Onboarding'), position: 0 },
      { id: 'md000000-0000-4000-8000-000000000006', course_id: K6, title: 'Secreto', duration: '1h', lessons: lessons(1, 'Secreto'), position: 0 },
    ],
    course_programs: [
      { course_id: K5, program_id: P1 },
      { course_id: K6, program_id: P3 },
    ],
    enrollments: [
      { student_id: S1, course_id: K1, status: 'em_andamento' },
      { student_id: S1, course_id: K2, status: 'concluido' },
      { student_id: S1, course_id: K5, status: 'em_andamento' },
    ],
    lesson_progress: [
      { student_id: S1, course_id: K1, module_index: 0, lesson_index: 0 },
      { student_id: S1, course_id: K2, module_index: 0, lesson_index: 0 },
      { student_id: S1, course_id: K2, module_index: 0, lesson_index: 1 },
    ],
    certificates: [{ id: 'ce000000-0000-4000-8000-000000000001', student_id: S1, course_id: K2, issued_at: iso(-20), course_title: 'Introdução a Dados', course_hours: 8, instructor: 'Carlos Andrade (QA)', company_name: null }],
    jobs: [
      { id: 'jb000000-0000-4000-8000-000000000001', company_id: C1, title: 'Dev Front-end Júnior', description: 'Vaga para quem concluiu a trilha.', requirements: ['React', 'TypeScript'], department: 'Engenharia', type: 'Efetivo', mode: 'Híbrido', location: 'São Paulo - SP', status: 'aberta', applications_count: 1, created_at: iso(-5) },
      { id: 'jb000000-0000-4000-8000-000000000002', company_id: C1, title: 'Estágio em Dados', description: 'Vaga encerrada.', requirements: ['SQL'], department: 'Dados', type: 'Estágio', mode: 'Remoto', location: null, status: 'encerrada', applications_count: 0, created_at: iso(-40) },
      { id: 'jb000000-0000-4000-8000-000000000003', company_id: C2, title: 'Vaga Secreta Outra Empresa', description: 'Não deve vazar.', requirements: [], department: 'Loja', type: 'Trainee', mode: 'Presencial', location: 'Recife - PE', status: 'aberta', applications_count: 0, created_at: iso(-2) },
    ],
    job_programs: [
      { job_id: 'jb000000-0000-4000-8000-000000000001', program_id: P1 },
      { job_id: 'jb000000-0000-4000-8000-000000000002', program_id: P1 },
      { job_id: 'jb000000-0000-4000-8000-000000000003', program_id: P3 },
    ],
    job_applications: [{ id: 'ja000000-0000-4000-8000-000000000001', job_id: 'jb000000-0000-4000-8000-000000000001', student_id: S1, status: 'enviada', applied_at: iso(-3) }],
    enrollment_requests: [
      { id: 'er000000-0000-4000-8000-000000000001', student_id: S4, company_id: C1, program_id: P1, status: 'pendente', requested_at: iso(-1) },
      { id: 'er000000-0000-4000-8000-000000000002', student_id: S1, company_id: C1, program_id: P1, status: 'ativo', requested_at: iso(-60) },
    ],
    mentor_invites: [
      { id: 'mi000000-0000-4000-8000-000000000001', company_id: C1, name: 'Convidada Pendente', email: 'convidada@qa.example.com', status: 'pendente', invited_at: iso(-2) },
      { id: 'mi000000-0000-4000-8000-000000000002', company_id: C1, name: 'Eduardo Silva (QA)', email: 'eduardo@qa.example.com', status: 'aceito', invited_at: iso(-50) },
    ],
    mentor_sessions: [
      { id: 'ms000000-0000-4000-8000-000000000001', mentor_id: M1, student_id: S1, date: date(3), start_time: '14:00:00', end_time: '15:00:00', status: 'agendada', topic: 'Revisão de portfólio', rating: null, review: null },
      { id: 'ms000000-0000-4000-8000-000000000002', mentor_id: M1, student_id: S1, date: date(-10), start_time: '10:00:00', end_time: '11:00:00', status: 'concluida', topic: 'Plano de carreira', rating: 5, review: 'Ótima conversa!' },
      { id: 'ms000000-0000-4000-8000-000000000003', mentor_id: M1, student_id: S1, date: date(-3), start_time: '10:00:00', end_time: '11:00:00', status: 'cancelada', topic: 'Sessão cancelada', rating: null, review: null },
      { id: 'ms000000-0000-4000-8000-000000000004', mentor_id: M1, student_id: S2, date: date(-1), start_time: '09:00:00', end_time: '10:00:00', status: 'agendada', topic: 'Sessão que já passou sem avaliação', rating: null, review: null },
    ],
    mentor_session_notes: [{ session_id: 'ms000000-0000-4000-8000-000000000002', mentor_id: M1, notes: 'Aluno quer migrar para front-end.', updated_at: iso(-10) }],
    activity_items: [
      { id: 'ai000000-0000-4000-8000-000000000001', student_id: S1, type: 'curso', description: 'Matriculou-se em Fundamentos de React', date: date(-15) },
      { id: 'ai000000-0000-4000-8000-000000000002', student_id: S1, type: 'certificado', description: 'Certificado: Introdução a Dados', date: date(-20) },
    ],
    mentor_activities: [
      { id: 'ma000000-0000-4000-8000-000000000001', mentor_id: M1, student_id: S1, title: 'Montar portfólio', description: 'Publique 2 projetos.', due_date: date(7), status: 'pendente', created_at: iso(-4), submission: null, submission_url: null, submitted_at: null, feedback: null, reviewed_at: null },
      { id: 'ma000000-0000-4000-8000-000000000002', mentor_id: M1, student_id: S1, title: 'Entrega com link perigoso', description: null, due_date: date(-1), status: 'entregue', created_at: iso(-8), submission: 'Segue meu trabalho <b>negrito?</b>', submission_url: 'javascript:alert(document.cookie)', submitted_at: iso(-2), feedback: null, reviewed_at: null },
      { id: 'ma000000-0000-4000-8000-000000000003', mentor_id: M1, student_id: S1, title: 'Atividade concluída', description: 'Ok', due_date: null, status: 'concluida', created_at: iso(-30), submission: 'Feito', submission_url: 'https://example.com/trabalho', submitted_at: iso(-25), feedback: 'Muito bom', reviewed_at: iso(-24) },
    ],
    mentor_messages: [
      { id: 'mm000000-0000-4000-8000-000000000001', mentor_id: M1, student_id: S1, sender_id: S1, body: 'Oi Beatriz, tenho uma dúvida sobre hooks.', read: true, created_at: iso(-2) },
      { id: 'mm000000-0000-4000-8000-000000000002', mentor_id: M1, student_id: S1, sender_id: M1, body: 'Claro! Pode mandar. <script>alert(1)</script>', read: false, created_at: iso(-1) },
    ],
  }
  return { users, tables: t }
}

/** Chave primária de cada tabela (para upsert/duplicidade). */
export const PRIMARY_KEYS = {
  profiles: ['id'],
  companies: ['id'],
  company_admins: ['id'],
  programs: ['id'],
  students: ['id'],
  mentors: ['id'],
  mentor_programs: ['mentor_id', 'program_id'],
  availability: ['id'],
  courses: ['id'],
  modules: ['id'],
  course_programs: ['course_id', 'program_id'],
  enrollments: ['student_id', 'course_id'],
  lesson_progress: ['student_id', 'course_id', 'module_index', 'lesson_index'],
  certificates: ['id'],
  jobs: ['id'],
  job_programs: ['job_id', 'program_id'],
  job_applications: ['id'],
  enrollment_requests: ['id'],
  mentor_invites: ['id'],
  mentor_sessions: ['id'],
  mentor_session_notes: ['session_id'],
  activity_items: ['id'],
  mentor_activities: ['id'],
  mentor_messages: ['id'],
}
