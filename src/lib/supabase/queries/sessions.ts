import { supabase } from '../../supabaseClient'
import type { ActivityItem, Certificate, MentorSession } from '../../../types'

interface SessionRow {
  id: string
  mentor_id: string
  aluno_id: string
  data: string
  hora_inicio: string
  hora_fim: string
  status: MentorSession['status']
  tema: string
  nota: number | null
  avaliacao: string | null
  /** sessao_id é a PK de anotacao_sessao_mentoria (relação 1:1), então o PostgREST devolve objeto, não lista. */
  anotacao_sessao_mentoria?: { anotacao: string } | { anotacao: string }[] | null
}

function toSession(row: SessionRow): MentorSession {
  const noteRow = Array.isArray(row.anotacao_sessao_mentoria) ? row.anotacao_sessao_mentoria[0] : row.anotacao_sessao_mentoria
  return {
    id: row.id,
    mentorId: row.mentor_id,
    studentId: row.aluno_id,
    date: row.data,
    start: row.hora_inicio.slice(0, 5),
    end: row.hora_fim.slice(0, 5),
    status: row.status,
    topic: row.tema,
    rating: row.nota ?? undefined,
    review: row.avaliacao ?? undefined,
    notes: noteRow?.anotacao ?? undefined,
  }
}

export async function fetchMentorSessions(): Promise<MentorSession[]> {
  const { data, error } = await supabase.from('sessao_mentoria').select('*, anotacao_sessao_mentoria(anotacao)')
  if (error) throw error
  return (data ?? []).map(toSession)
}

export async function upsertMentorSessionNotes(sessionId: string, mentorId: string, notes: string) {
  const { error } = await supabase
    .from('anotacao_sessao_mentoria')
    .upsert({ sessao_id: sessionId, mentor_id: mentorId, anotacao: notes, atualizado_em: new Date().toISOString() })
  if (error) throw error
}

interface CertificateRow {
  id: string
  aluno_id: string
  curso_id: string | null
  emitido_em: string
  // Colunas de "retrato" do curso: só existem depois do SQL de certificados (ainda não aplicado; os nomes
  // abaixo são os do rascunho em inglês). `select('*')` funciona com ou sem elas.
  course_title?: string | null
  course_hours?: number | null
  instructor?: string | null
  company_name?: string | null
}

function toCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    studentId: row.aluno_id,
    courseId: row.curso_id ?? '',
    issuedAt: row.emitido_em.slice(0, 10),
    courseTitle: row.course_title ?? undefined,
    courseHours: row.course_hours ?? undefined,
    instructor: row.instructor ?? undefined,
    companyName: row.company_name ?? undefined,
  }
}

export async function fetchCertificates(): Promise<Certificate[]> {
  const { data, error } = await supabase.from('certificado').select('*')
  if (error) throw error
  return (data ?? []).map(toCertificate)
}

interface ActivityRow {
  id: string
  aluno_id: string
  tipo: ActivityItem['type']
  descricao: string
  data: string
}

function toActivity(row: ActivityRow): ActivityItem {
  return { id: row.id, studentId: row.aluno_id, type: row.tipo, description: row.descricao, date: row.data }
}

export async function fetchActivityItems(): Promise<ActivityItem[]> {
  const { data, error } = await supabase.from('item_atividade').select('*')
  if (error) throw error
  return (data ?? []).map(toActivity)
}
