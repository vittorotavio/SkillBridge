import { supabase } from '../supabaseClient'
import { isMissingRpc, userError } from '../errors'

export async function enrollInCourse(courseId: string) {
  const { data, error } = await supabase.rpc('enroll_in_course', { p_course_id: courseId })
  if (error) throw error
  return data
}

export async function applyToJob(jobId: string) {
  const { data, error } = await supabase.rpc('apply_to_job', { p_job_id: jobId })
  if (error) throw error
  return data
}

export async function bookMentorSession(availabilityId: string, date: string, topic: string) {
  const { data, error } = await supabase.rpc('book_mentor_session', { p_availability_id: availabilityId, p_date: date, p_topic: topic })
  if (error) throw error
  return data
}

export async function inviteExistingStudent(programId: string, email: string) {
  const { data, error } = await supabase.rpc('invite_existing_student', { p_program_id: programId, p_email: email })
  if (error) throw error
  return data
}

export async function completeLesson(courseId: string, moduleIndex: number, lessonIndex: number) {
  const { data, error } = await supabase.rpc('complete_lesson', {
    p_course_id: courseId,
    p_module_index: moduleIndex,
    p_lesson_index: lessonIndex,
  })
  if (error) {
    if (/activity not passed/.test(error.message)) throw userError('Acerte todas as perguntas da atividade antes de concluir a aula.')
    throw error
  }
  return data as { done: number; total: number; course_completed: boolean }
}

export interface ActivityAnswerResult {
  correct: boolean[]
  passed: boolean
  explanations?: (string | null)[]
}

/**
 * Corrige a atividade no servidor (o aluno não recebe o gabarito) e, se tudo estiver certo, registra a
 * aprovação exigida pelo complete_lesson. Devolve null quando a RPC ainda não existe no banco.
 */
export async function answerLessonActivity(courseId: string, moduleIndex: number, lessonIndex: number, answers: number[]): Promise<ActivityAnswerResult | null> {
  const { data, error } = await supabase.rpc('answer_lesson_activity', {
    p_course_id: courseId,
    p_module_index: moduleIndex,
    p_lesson_index: lessonIndex,
    p_answers: answers,
  })
  if (error) {
    if (isMissingRpc(error)) return null
    throw error
  }
  const result = data as { corretas: boolean[]; aprovado: boolean; explicacoes: (string | null)[] | null }
  return { correct: result.corretas ?? [], passed: !!result.aprovado, explanations: result.explicacoes ?? undefined }
}

export async function submitActivity(activityId: string, answer: string, url?: string) {
  const { data, error } = await supabase.rpc('submit_activity', { p_activity_id: activityId, p_answer: answer, p_url: url ?? null })
  if (error) throw error
  return data
}

export async function cancelMentorSession(sessionId: string) {
  const { data, error } = await supabase.rpc('cancel_mentor_session', { p_session_id: sessionId })
  if (error) throw error
  return data
}

export async function reviewMentorSession(sessionId: string, rating: number, review: string) {
  const { data, error } = await supabase.rpc('review_mentor_session', { p_session_id: sessionId, p_rating: rating, p_review: review })
  if (error) throw error
  return data
}

/**
 * Vincula o mentor logado à empresa que convidou o e-mail dele (convite pendente → aceito).
 * Devolve o id da empresa vinculada, ou null quando não havia convite. Enquanto a RPC não
 * existir no banco (PGRST202), não faz nada — o login segue normalmente.
 */
export async function acceptMentorInvites(): Promise<string | null> {
  const { data, error } = await supabase.rpc('accept_mentor_invites')
  if (error) {
    if (isMissingRpc(error)) return null
    throw error
  }
  return (data as string | null) ?? null
}

/**
 * Desvincula um mentor da empresa logada (tira o empresa_id e os vínculos com os treinamentos dela),
 * preservando a conta, o histórico de sessões e as atividades. Antes o app apagava a linha do mentor.
 */
export async function unlinkCompanyMentor(mentorId: string) {
  const { error } = await supabase.rpc('unlink_company_mentor', { p_mentor_id: mentorId })
  if (error) {
    if (isMissingRpc(error)) {
      throw userError('Remover mentor depende de uma atualização no servidor (função "unlink_company_mentor") que ainda não foi aplicada.')
    }
    throw error
  }
}

/**
 * Libera horários semanais que ficaram marcados como reservados por sessões que já passaram (sem
 * isso o horário só voltava quando o aluno avaliava). É um extra: se a RPC não existir, ignora.
 */
export async function releasePastSessionSlots() {
  const { error } = await supabase.rpc('release_past_session_slots')
  if (error && !isMissingRpc(error)) console.warn('release_past_session_slots falhou', error)
}
