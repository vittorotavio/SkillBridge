import { supabase } from '../../supabaseClient'
import type { Student } from '../../../types'

interface StudentRow {
  id: string
  nome: string
  email: string
  url_avatar: string | null
  biografia: string | null
  empresa_id: string | null
  programa_id: string | null
  tempo_estudo: number
  matricula?: { curso_id: string; status: 'em_andamento' | 'concluido' }[]
  certificado?: { id: string }[]
}

function toStudent(row: StudentRow): Student {
  return {
    id: row.id,
    type: 'student',
    name: row.nome,
    email: row.email,
    avatarUrl: row.url_avatar ?? undefined,
    bio: row.biografia ?? undefined,
    companyId: row.empresa_id ?? undefined,
    programId: row.programa_id ?? undefined,
    enrolledCourseIds: (row.matricula ?? []).map((e) => e.curso_id),
    completedCourseIds: (row.matricula ?? []).filter((e) => e.status === 'concluido').map((e) => e.curso_id),
    certificateIds: (row.certificado ?? []).map((c) => c.id),
    studyHours: row.tempo_estudo,
  }
}

const SELECT = '*, matricula(curso_id, status), certificado(id)'

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await supabase.from('aluno').select(SELECT)
  if (error) throw error
  return (data ?? []).map(toStudent)
}

export async function fetchStudentById(id: string): Promise<Student | null> {
  const { data, error } = await supabase.from('aluno').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toStudent(data) : null
}

export async function insertStudentRow(id: string, name: string, email: string) {
  const { error } = await supabase.from('aluno').insert({ id, nome: name, email })
  if (error) throw error
}

export async function updateStudentRow(
  id: string,
  patch: Partial<{ companyId: string | null; programId: string | null; bio: string; name: string }>
) {
  const fields: Record<string, unknown> = {}
  if (patch.name !== undefined) fields.nome = patch.name
  if (patch.companyId !== undefined) fields.empresa_id = patch.companyId
  if (patch.programId !== undefined) fields.programa_id = patch.programId
  if (patch.bio !== undefined) fields.biografia = patch.bio
  if (Object.keys(fields).length === 0) return
  const { error } = await supabase.from('aluno').update(fields).eq('id', id)
  if (error) throw error
}
