import { supabase } from '../../supabaseClient'
import type { ActivityQuestion, Course, LessonContent, Module } from '../../../types'
import { userError } from '../../errors'

/** Pergunta como fica em modulo.conteudo_aula: visível ao aluno, sem a resposta certa. */
interface ActivityQuestionRow {
  pergunta: string
  alternativas: string[]
  /** Formato antigo (antes do gabarito separado): resposta e explicação dentro do conteúdo. */
  correta?: number | null
  explicacao?: string | null
}

/** Um item por aula, na ordem de `aula`. Coluna jsonb `conteudo_aula`. */
interface LessonContentRow {
  video?: string | null
  credito?: string | null
  material?: string | null
  atividade?: ActivityQuestionRow[] | null
}

/** Linha de gabarito_aula: só o admin da empresa dona do curso enxerga (RLS). */
interface AnswerKeyRow {
  indice_aula: number
  respostas: number[]
  explicacoes: (string | null)[] | null
}

interface ModuleRow {
  id: string
  titulo: string
  duracao: string
  aula: string[]
  posicao: number
  conteudo_aula?: LessonContentRow[] | null
  gabarito_aula?: AnswerKeyRow[] | null
}

interface CourseRow {
  id: string
  titulo: string
  resumo: string
  categoria: string
  carga_horaria: number
  instrutor: string
  instrutor_mentor_id: string | null
  url_capa: string | null
  status: Course['status']
  empresa_id: string | null
  total_matricula: number
  nota: number
  modulo?: ModuleRow[]
  curso_programa?: { programa_id: string }[]
}

function toQuestion(row: ActivityQuestionRow, key: AnswerKeyRow | undefined, index: number): ActivityQuestion | null {
  if (!row?.pergunta || !Array.isArray(row.alternativas) || row.alternativas.length < 2) return null
  const correct = key?.respostas?.[index] ?? row.correta ?? undefined
  const valid = correct !== undefined && Number.isInteger(correct) && correct >= 0 && correct < row.alternativas.length
  return {
    question: row.pergunta,
    options: row.alternativas,
    correct: valid ? correct : undefined,
    explanation: key?.explicacoes?.[index] || row.explicacao || undefined,
  }
}

function toLessonContent(row: LessonContentRow | null | undefined, key: AnswerKeyRow | undefined): LessonContent {
  const activity = Array.isArray(row?.atividade)
    ? row.atividade.map((q, i) => toQuestion(q, key, i)).filter((q): q is ActivityQuestion => !!q)
    : []
  return {
    videoUrl: row?.video || undefined,
    videoCredit: row?.credito || undefined,
    material: row?.material || undefined,
    activity: activity.length ? activity : undefined,
  }
}

function toCourse(row: CourseRow): Course {
  const modules: Module[] = [...(row.modulo ?? [])]
    // Mesmo critério (posicao, id) que a RPC complete_lesson usa para numerar os módulos.
    .sort((a, b) => a.posicao - b.posicao || (a.id < b.id ? -1 : 1))
    .map((m) => ({
      id: m.id,
      title: m.titulo,
      duration: m.duracao,
      lessons: m.aula ?? [],
      contents: Array.isArray(m.conteudo_aula)
        ? m.conteudo_aula.map((c, i) => toLessonContent(c, m.gabarito_aula?.find((k) => k.indice_aula === i)))
        : [],
    }))
  return {
    id: row.id,
    title: row.titulo,
    summary: row.resumo,
    category: row.categoria,
    totalHours: row.carga_horaria,
    modules,
    instructor: row.instrutor,
    instructorMentorId: row.instrutor_mentor_id ?? undefined,
    coverUrl: row.url_capa ?? '',
    status: row.status,
    companyId: row.empresa_id ?? undefined,
    programIds: (row.curso_programa ?? []).map((cp) => cp.programa_id),
    enrolledCount: row.total_matricula,
    rating: row.nota,
  }
}

const SELECT = '*, modulo(*, gabarito_aula(indice_aula, respostas, explicacoes)), curso_programa(programa_id)'
/** Sem o gabarito: para bancos em que a tabela gabarito_aula ainda não foi criada. */
const SELECT_WITHOUT_KEYS = '*, modulo(*), curso_programa(programa_id)'

/** Tabela ou relacionamento ainda não criado no banco (PostgREST). */
const isMissingRelation = (err: { code?: string } | null) => err?.code === 'PGRST200' || err?.code === 'PGRST205'

/**
 * A tabela gabarito_aula já existe no banco? Enquanto não existir, as respostas continuam dentro de
 * conteudo_aula (formato antigo): gravá-las numa tabela inexistente apagaria o gabarito ao salvar.
 */
let answerKeyTable: boolean | null = null
async function hasAnswerKeyTable(): Promise<boolean> {
  if (answerKeyTable !== null) return answerKeyTable
  const { error } = await supabase.from('gabarito_aula').select('modulo_id').limit(0)
  answerKeyTable = !isMissingRelation(error)
  return answerKeyTable
}

/**
 * Linhas de `modulo` e de `gabarito_aula` para gravar. O conteúdo vai sem as respostas certas (o
 * aluno lê `conteudo_aula`); elas ficam no gabarito, ligado ao módulo pelo id gerado aqui.
 * Com `legacy`, as respostas ficam dentro do conteúdo (banco ainda sem gabarito_aula).
 */
function moduleRows(courseId: string, modules: Module[], legacy = false) {
  const keys: { modulo_id: string; indice_aula: number; respostas: number[]; explicacoes: (string | null)[] }[] = []
  const rows = modules.map((m, i) => {
    const id = crypto.randomUUID()
    const contents = m.lessons.map((_, j) => {
      const c = m.contents?.[j]
      const activity = c?.activity ?? []
      if (activity.length && !legacy) {
        keys.push({
          modulo_id: id,
          indice_aula: j,
          respostas: activity.map((q) => q.correct ?? 0),
          explicacoes: activity.map((q) => q.explanation?.trim() || null),
        })
      }
      return {
        video: c?.videoUrl?.trim() || null,
        credito: c?.videoCredit?.trim() || null,
        material: c?.material?.trim() || null,
        ...(activity.length
          ? {
              atividade: activity.map((q) =>
                legacy
                  ? { pergunta: q.question, alternativas: q.options, correta: q.correct ?? 0, ...(q.explanation ? { explicacao: q.explanation } : {}) }
                  : { pergunta: q.question, alternativas: q.options }
              ),
            }
          : {}),
      }
    })
    const hasContent = contents.some((c) => c.video || c.credito || c.material || c.atividade)
    return {
      id,
      curso_id: courseId,
      titulo: m.title,
      duracao: m.duration,
      aula: m.lessons,
      posicao: i,
      ...(hasContent ? { conteudo_aula: contents } : {}),
    }
  })
  return { rows, keys }
}

/** Coluna/tabela nova ainda não criada no banco: mensagem clara em vez de "não foi possível salvar". */
function explainMissingContentStorage(err: { code?: string; message?: string }) {
  if ((err.code === 'PGRST204' && /conteudo_aula/.test(err.message ?? '')) || (err.code === 'PGRST205' && /gabarito_aula/.test(err.message ?? ''))) {
    return userError('Vídeo, material e atividades das aulas dependem de uma atualização no servidor que ainda não foi aplicada.')
  }
  return err
}

async function insertModules(courseId: string, modules: Module[]) {
  const { rows, keys } = moduleRows(courseId, modules, !(await hasAnswerKeyTable()))
  const { error } = await supabase.from('modulo').insert(rows)
  if (error) throw explainMissingContentStorage(error)
  if (keys.length) {
    const { error: keyErr } = await supabase.from('gabarito_aula').insert(keys)
    if (keyErr) throw explainMissingContentStorage(keyErr)
  }
}

export async function fetchCourses(): Promise<Course[]> {
  let { data, error } = await supabase.from('curso').select(SELECT)
  if (isMissingRelation(error)) ({ data, error } = await supabase.from('curso').select(SELECT_WITHOUT_KEYS))
  if (error) throw error
  return (data ?? []).map(toCourse)
}

export async function insertCourseRow(input: Omit<Course, 'id' | 'enrolledCount' | 'rating'>) {
  // Id gerado aqui e insert sem .select(): o RETURNING passaria pela política de leitura, cuja função
  // (fn_course_visible) consulta a própria tabela e ainda não enxerga a linha nova — o Postgres recusava o insert.
  const courseId = crypto.randomUUID()
  const { error } = await supabase
    .from('curso')
    .insert({
      id: courseId,
      titulo: input.title,
      resumo: input.summary,
      categoria: input.category,
      carga_horaria: input.totalHours,
      instrutor: input.instructor,
      instrutor_mentor_id: input.instructorMentorId ?? null,
      url_capa: input.coverUrl || null,
      status: input.status,
      empresa_id: input.companyId ?? null,
    })
  if (error) throw error
  if (input.modules.length) await insertModules(courseId, input.modules)
  if (input.programIds.length) {
    const { error: cpErr } = await supabase.from('curso_programa').insert(input.programIds.map((pid) => ({ curso_id: courseId, programa_id: pid })))
    if (cpErr) throw cpErr
  }
}

export async function updateCourseRow(id: string, patch: Partial<Course>) {
  const fields: Record<string, unknown> = {}
  if (patch.title !== undefined) fields.titulo = patch.title
  if (patch.summary !== undefined) fields.resumo = patch.summary
  if (patch.category !== undefined) fields.categoria = patch.category
  if (patch.totalHours !== undefined) fields.carga_horaria = patch.totalHours
  if (patch.instructor !== undefined) fields.instrutor = patch.instructor
  if (patch.instructorMentorId !== undefined) fields.instrutor_mentor_id = patch.instructorMentorId ?? null
  if (patch.coverUrl !== undefined) fields.url_capa = patch.coverUrl || null
  if (patch.status !== undefined) fields.status = patch.status
  if (patch.companyId !== undefined) fields.empresa_id = patch.companyId ?? null
  if (Object.keys(fields).length) {
    const { error } = await supabase.from('curso').update(fields).eq('id', id)
    if (error) throw error
  }
  if (patch.modules) {
    // Apagar o módulo apaga o gabarito dele (on delete cascade); os novos são gravados em seguida.
    const { error: delErr } = await supabase.from('modulo').delete().eq('curso_id', id)
    if (delErr) throw delErr
    if (patch.modules.length) await insertModules(id, patch.modules)
  }
  if (patch.programIds) {
    const { error: delErr } = await supabase.from('curso_programa').delete().eq('curso_id', id)
    if (delErr) throw delErr
    if (patch.programIds.length) {
      const { error } = await supabase.from('curso_programa').insert(patch.programIds.map((pid) => ({ curso_id: id, programa_id: pid })))
      if (error) throw error
    }
  }
}

export async function deleteCourseRow(id: string) {
  const { error } = await supabase.from('curso').delete().eq('id', id)
  if (error) throw error
}
